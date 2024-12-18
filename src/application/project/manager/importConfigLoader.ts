import {z} from 'zod';
import {Minimatch} from 'minimatch';
import {Filesystem} from '@/application/filesystem/filesystem';
import {JsonParser} from '@/infrastructure/json';

type ImportConfig = {
    rootConfigPath: string,
    matchedConfigPath: string,
    baseUrl: string,
    paths: Record<string, string[]>,
};

const configSchema = z.object({
    extends: z.string().optional(),
    references: z.array(z.object({path: z.string()})).optional(),
    include: z.array(z.string()).optional(),
    compilerOptions: z.object({
        baseUrl: z.string().optional(),
        paths: z.record(z.array(z.string())).optional(),
    }).optional(),
});

type ConfigFile = {
    rootConfigPath: string,
    matchedConfigPath: string,
    extends?: string,
    references?: Array<{path: string}>,
    include?: string[],
    compilerOptions?: {
        baseUrl?: string,
        paths?: Record<string, string[]>,
    },
};

export type Options = {
    fileNames?: string[],
    sourcePaths?: string[],
};

type Resolution = {
    configPath: string,
    fileNames: string[],
    rootDirectory: string,
    targetDirectories: string[],
};

export class ImportConfigLoader {
    private readonly filesystem: Filesystem;

    public constructor(filesystem: Filesystem) {
        this.filesystem = filesystem;
    }

    public async load(directory: string, options: Options = {}): Promise<ImportConfig | null> {
        const {fileNames = ['tsconfig.json']} = options;
        const rootDirectory = await this.filesystem.getRealPath(directory);
        const configPath = await this.locateConfig(directory, fileNames, true);

        if (configPath === null) {
            return null;
        }

        const config = await this.resolveConfig({
            rootDirectory: rootDirectory,
            configPath: configPath,
            fileNames: fileNames,
            targetDirectories: (options.sourcePaths ?? []).map(
                sourcePath => (
                    this.filesystem.isAbsolute(sourcePath)
                        ? sourcePath
                        : this.filesystem.joinPaths(rootDirectory, sourcePath)
                ),
            ),
        });

        if (config === null) {
            return null;
        }

        return {
            rootConfigPath: config.rootConfigPath,
            matchedConfigPath: config.matchedConfigPath,
            baseUrl: this.filesystem.joinPaths(
                this.filesystem.getDirectoryName(config.matchedConfigPath),
                config.compilerOptions?.baseUrl ?? '.',
            ),
            paths: config.compilerOptions?.paths ?? {},
        };
    }

    private async locateConfig(path: string, fileNames: string[], recursive = false): Promise<string | null> {
        for (const fileName of fileNames) {
            const filePath = this.filesystem.joinPaths(path, fileName);

            if (await this.filesystem.exists(filePath)) {
                return filePath;
            }
        }

        if (!recursive) {
            return null;
        }

        const parent = this.filesystem.getDirectoryName(path);

        if (parent === path) {
            return null;
        }

        return this.locateConfig(parent, fileNames);
    }

    private async resolveConfig(resolution: Resolution): Promise<ConfigFile | null> {
        const {configPath, fileNames, rootDirectory, targetDirectories} = resolution;
        let config = await this.parseConfig(configPath);

        if (config?.extends !== undefined) {
            const parentPath = await this.locateParentConfig(
                rootDirectory,
                this.filesystem.getDirectoryName(configPath),
                config.extends,
            );

            if (parentPath !== null) {
                const parentConfig = await this.resolveConfig({
                    ...resolution,
                    configPath: parentPath,
                });

                if (parentConfig !== null) {
                    config = ImportConfigLoader.mergeConfig(config, parentConfig);
                }
            }
        }

        if (config?.references !== undefined && targetDirectories.length > 0) {
            const {references: _, ...parentConfig} = config;

            for (const reference of config.references) {
                const referencePath = this.filesystem.joinPaths(
                    this.filesystem.getDirectoryName(configPath),
                    reference.path,
                );
                const resolvedReferencePath = referencePath.endsWith('.json')
                    ? referencePath
                    : await this.locateConfig(referencePath, fileNames);

                if (resolvedReferencePath === null) {
                    continue;
                }

                const referenceConfig = await this.resolveConfig({
                    ...resolution,
                    configPath: resolvedReferencePath,
                });

                if (referenceConfig?.include === undefined) {
                    continue;
                }

                for (const targetDirectory of targetDirectories) {
                    const relativeTargetDirectory = this.filesystem.joinPaths(
                        './',
                        this.filesystem.getRelativePath(
                            this.filesystem.getDirectoryName(resolvedReferencePath),
                            targetDirectory,
                        ),
                    );

                    for (const include of referenceConfig.include) {
                        let minimatch = new Minimatch(include, {
                            partial: true,
                            magicalBraces: true,
                        });

                        if (!minimatch.hasMagic() && !include.includes('.')) {
                            minimatch = new Minimatch(`${include.replace(/\/?$/, '')}/**/*`, {
                                partial: true,
                            });
                        }

                        if (minimatch.match(relativeTargetDirectory)) {
                            return ImportConfigLoader.mergeConfig(
                                {
                                    ...referenceConfig,
                                    rootConfigPath: config.rootConfigPath,
                                },
                                parentConfig,
                            );
                        }
                    }
                }
            }
        }

        return config;
    }

    private async locateParentConfig(root: string, directory: string, parent: string): Promise<string | null> {
        let parentPath = parent;

        if (!parentPath.endsWith('.json')) {
            parentPath += '.json';
        }

        const relativePath = this.filesystem.joinPaths(directory, parentPath);

        if (await this.filesystem.exists(relativePath)) {
            return relativePath;
        }

        const modulePath = this.filesystem.joinPaths(root, 'node_modules', parentPath);

        if (await this.filesystem.exists(modulePath)) {
            return modulePath;
        }

        return null;
    }

    private async parseConfig(filePath: string): Promise<ConfigFile | null> {
        try {
            const content = await this.filesystem.readFile(filePath);

            return {
                rootConfigPath: filePath,
                matchedConfigPath: filePath,
                ...configSchema.parse(JsonParser.parse(content).toJSON()),
            };
        } catch {
            return null;
        }
    }

    private static mergeConfig(config: ConfigFile, parentConfig: Partial<ConfigFile>): ConfigFile {
        return {
            ...parentConfig,
            ...config,
            compilerOptions: {
                ...parentConfig.compilerOptions,
                ...config.compilerOptions,
            },
        };
    }
}
