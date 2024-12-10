import {dirname, join} from 'path';
import {z} from 'zod';
import Json5 from 'json5';
import {Filesystem} from '@/application/filesystem';

type ImportConfig = {
    path: string,
    baseUrl: string,
    paths: Record<string, string[]>,
};

const configSchema = z.object({
    extends: z.string().optional(),
    compilerOptions: z.object({
        baseUrl: z.string().optional(),
        paths: z.record(z.array(z.string())).optional(),
    }).optional(),
});

type ConfigFile = {
    extends?: string,
    compilerOptions?: {
        baseUrl?: string,
        paths?: Record<string, string[]>,
    },
};

export class ImportConfigLoader {
    private readonly filesystem: Filesystem;

    public constructor(filesystem: Filesystem) {
        this.filesystem = filesystem;
    }

    public async load(directory: string, fileNames: string[]): Promise<ImportConfig | null> {
        const path = await this.locateConfig(directory, fileNames);

        if (path === null) {
            return null;
        }

        const config = await this.resolveConfig(directory, path);

        if (config === null) {
            return null;
        }

        return {
            path: path,
            baseUrl: join(directory, config.compilerOptions?.baseUrl ?? ''),
            paths: config.compilerOptions?.paths ?? {},
        };
    }

    private async locateConfig(path: string, fileNames: string[]): Promise<string | null> {
        for (const fileName of fileNames) {
            const filePath = join(path, fileName);

            if (await this.filesystem.exists(filePath)) {
                return filePath;
            }
        }

        const parent = dirname(path);

        if (parent === path) {
            return null;
        }

        return this.locateConfig(parent, fileNames);
    }

    private async resolveConfig(root: string, filePath: string): Promise<ConfigFile | null> {
        const config = await this.parseConfig(filePath);

        if (config?.extends !== undefined) {
            const parentPath = await this.locateParentConfig(root, dirname(filePath), config.extends);

            if (parentPath !== null) {
                const parentConfig = await this.resolveConfig(root, parentPath);

                return {
                    ...parentConfig,
                    ...config,
                    compilerOptions: {
                        ...parentConfig?.compilerOptions,
                        ...config.compilerOptions,
                    },
                };
            }
        }

        return config;
    }

    private async locateParentConfig(root: string, directory: string, parent: string): Promise<string | null> {
        let parentPath = parent;

        if (!parentPath.endsWith('.json')) {
            parentPath += '.json';
        }

        const relativePath = join(directory, parentPath);

        if (await this.filesystem.exists(relativePath)) {
            return relativePath;
        }

        const modulePath = join(root, 'node_modules', parentPath);

        if (await this.filesystem.exists(modulePath)) {
            return modulePath;
        }

        return null;
    }

    private async parseConfig(filePath: string): Promise<ConfigFile | null> {
        try {
            const content = await this.filesystem.readFile(filePath);

            return configSchema.parse(Json5.parse(content));
        } catch {
            return null;
        }
    }
}
