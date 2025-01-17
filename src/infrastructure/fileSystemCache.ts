import {CacheLoader, CacheProvider} from '@croct/cache';
import {createHash} from 'crypto';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration = {
    fileSystem: FileSystem,
    directory: string,
};

export class FileSystemCache implements CacheProvider<string, string> {
    private readonly fileSystem: FileSystem;

    private readonly directory: string;

    public constructor({fileSystem, directory}: Configuration) {
        this.fileSystem = fileSystem;
        this.directory = directory;
    }

    public async delete(key: string): Promise<void> {
        await this.fileSystem.delete(this.getCacheFile(key));
    }

    public async get(key: string, loader: CacheLoader<string, string>): Promise<string> {
        try {
            return await this.fileSystem.readTextFile(this.getCacheFile(key));
        } catch {
            return loader(key);
        }
    }

    public async set(key: string, value: string): Promise<void> {
        if (!await this.fileSystem.exists(this.directory)) {
            await this.fileSystem.createDirectory(this.directory, {recursive: true});
        }

        return this.fileSystem.writeTextFile(this.getCacheFile(key), value);
    }

    private getCacheFile(key: string): string {
        return this.fileSystem.joinPaths(this.directory, createHash('md5').update(key).digest('hex'));
    }
}
