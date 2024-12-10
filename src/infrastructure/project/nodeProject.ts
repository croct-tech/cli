import {z} from 'zod';
import {installPackage} from '@antfu/install-pkg';
import {relative, join, isAbsolute} from 'path';
import {JavaScriptProject, PackageInfo, PackageInstallationOptions} from '@/application/project/project';
import {Filesystem} from '@/application/filesystem';
import {ImportConfigLoader} from '@/infrastructure/project/importConfigLoader';

export type Configuration = {
    directory: string,
    filesystem: Filesystem,
    importConfigLoader: ImportConfigLoader,
};

const packageSchema = z.object({
    name: z.string(),
    version: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
});

export class NodeProject implements JavaScriptProject {
    private readonly filesystem: Filesystem;

    private readonly importConfigLoader: ImportConfigLoader;

    private readonly directory: string;

    public constructor({directory, filesystem, importConfigLoader}: Configuration) {
        this.filesystem = filesystem;
        this.directory = directory;
        this.importConfigLoader = importConfigLoader;
    }

    public getRootPath(): string {
        return this.directory;
    }

    public getProjectPackagePath(): string {
        return join(this.directory, 'package.json');
    }

    public isTypeScriptProject(): Promise<boolean> {
        return this.isPackageListed('typescript');
    }

    public async getTypeScriptConfigPath(): Promise<string | null> {
        const config = await this.importConfigLoader.load(this.directory, ['tsconfig.json']);

        if (config === null) {
            return null;
        }

        return config.path;
    }

    public async readFile(...fileNames: string[]): Promise<string | null> {
        const filePath = await this.locateFile(...fileNames);

        if (filePath === null) {
            return null;
        }

        return this.filesystem.readFile(join(this.getRootPath(), filePath));
    }

    public async locateFile(...fileNames: string[]): Promise<string | null> {
        const directory = this.getRootPath();

        for (const filename of fileNames) {
            if (isAbsolute(filename)) {
                throw new Error('The file path must be relative');
            }

            const fullPath = join(directory, filename);

            if (await this.filesystem.exists(fullPath)) {
                return filename;
            }
        }

        return null;
    }

    public async isPackageListed(packageName: string): Promise<boolean> {
        const info = await this.getPackageJson(this.getProjectPackagePath());

        if (info === null) {
            return false;
        }

        return (info.dependencies !== undefined && packageName in info.dependencies)
            || (info.devDependencies !== undefined && packageName in info.devDependencies);
    }

    public async getPackageInfo(packageName: string): Promise<PackageInfo|null> {
        const directory = join(this.directory, 'node_modules', packageName);
        const info = await this.getPackageJson(join(directory, 'package.json'));

        if (info === null) {
            return null;
        }

        return {
            name: info.name,
            version: info.version ?? null,
            path: directory,
            metadata: info,
        };
    }

    private async getPackageJson(path: string): Promise<z.infer<typeof packageSchema> | null> {
        if (!await this.filesystem.exists(path)) {
            return null;
        }

        try {
            return packageSchema.parse(JSON.parse(await this.filesystem.readFile(path)));
        } catch {
            return null;
        }
    }

    public async installPackage(packageName: string|string[], options: PackageInstallationOptions = {}): Promise<void> {
        await installPackage(packageName, {
            cwd: this.directory,
            silent: true,
            dev: options.dev,
        });
    }

    public async getImportPath(filePath: string, importPath?: string): Promise<string> {
        const config = await this.importConfigLoader.load(this.directory, ['tsconfig.json', 'jsconfig.json']);
        const resolvedBasePath = join(this.directory, filePath);

        if (config !== null) {
            const absoluteFilePath = resolvedBasePath.replace(/\\/g, '/');
            let longestMatchLength = 0;

            let currentPath: string | null = null;

            // Go through each alias and check if it matches the given filePath
            for (const [alias, aliasPaths] of Object.entries(config.paths)) {
                const cleanAlias = alias.replace(/\*$/, ''); // Remove wildcard from alias

                for (const aliasPath of aliasPaths) {
                    const cleanAliasPath = aliasPath.replace(/\*$/, ''); // Remove wildcard from alias path
                    const aliasBasePath = join(config.baseUrl, cleanAliasPath).replace(/\\/g, '/');

                    // Check if the file path starts with the alias base path
                    if (absoluteFilePath.startsWith(aliasBasePath)) {
                        const aliasMatchLength = cleanAliasPath.length;

                        if (aliasMatchLength > longestMatchLength) {
                            longestMatchLength = aliasMatchLength;

                            const remainder = absoluteFilePath.slice(aliasBasePath.length).replace(/^\//, '');

                            currentPath = cleanAlias + remainder;
                        }
                    }
                }
            }

            if (currentPath !== null) {
                return Promise.resolve(currentPath);
            }
        }

        const resolvedFilePath = join(resolvedBasePath, filePath);
        const resolvedRelativePath = importPath === undefined
            ? relative(this.directory, resolvedFilePath)
            : relative(join(resolvedBasePath, importPath), resolvedFilePath);

        return Promise.resolve(resolvedRelativePath.replace(/\\/g, '/'));
    }
}
