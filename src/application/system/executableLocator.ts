import {CacheProvider, NoopCache} from '@croct/cache';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration = {
    fileSystem: FileSystem,
    executablePaths: string[],
    executableExtensions?: string[],
    cache?: CacheProvider<string, string|null>,
};

export class ExecutableLocator {
    private readonly fileSystem: FileSystem;

    private readonly executablePaths: string[];

    private readonly executableExtensions: string[];

    private readonly executableCache: CacheProvider<string, string|null>;

    public constructor(configuration: Configuration) {
        this.fileSystem = configuration.fileSystem;
        this.executablePaths = configuration.executablePaths;
        this.executableExtensions = configuration.executableExtensions ?? [];
        this.executableCache = configuration.cache ?? new NoopCache();
    }

    public locate(command: string): Promise<string|null> {
        return this.executableCache.get(command, name => this.findPath(name));
    }

    private async findPath(command: string): Promise<string|null> {
        for (const path of this.executablePaths) {
            for (const extension of [...this.executableExtensions, '']) {
                const realPath = this.fileSystem.joinPaths(path, command + extension.toLowerCase());

                if (realPath !== null && await this.fileSystem.exists(realPath)) {
                    return realPath;
                }
            }
        }

        return null;
    }
}
