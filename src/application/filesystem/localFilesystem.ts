import {
    mkdir,
    readFile,
    writeFile,
    rm,
    lstat,
    realpath,
    cp,
} from 'fs/promises';
import {isAbsolute, join} from 'path';
import {
    DirectoryCopyOptions,
    DirectoryCreationOptions,
    DeletionOptions,
    Filesystem,
    FileWritingOptions,
} from '@/application/filesystem/filesystem';

export type Configuration = {
    currentDirectory: string,
    defaultEncoding: BufferEncoding,
};

export class LocalFilesystem implements Filesystem {
    private readonly config: Configuration;

    public constructor(configuration: Configuration) {
        this.config = configuration;
    }

    public getRealPath(path: string): Promise<string> {
        return realpath(this.resolvePath(path));
    }

    public async exists(path: string): Promise<boolean> {
        try {
            await lstat(this.resolvePath(path));

            return true;
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
                return false;
            }

            throw error;
        }
    }

    public async isSymbolicLink(path: string): Promise<boolean> {
        try {
            return (await lstat(this.resolvePath(path))).isSymbolicLink();
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
                return false;
            }

            throw error;
        }
    }

    public async isDirectory(path: string): Promise<boolean> {
        try {
            return (await lstat(this.resolvePath(path))).isDirectory();
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }

            throw error;
        }
    }

    public readFile(path: string): Promise<string> {
        return readFile(this.resolvePath(path), this.config.defaultEncoding);
    }

    public writeFile(path: string, content: string, options?: FileWritingOptions): Promise<void> {
        return writeFile(this.resolvePath(path), content, {
            flag: options?.overwrite === true ? 'w' : 'wx',
            encoding: this.config.defaultEncoding,
        });
    }

    public async createDirectory(path: string, options?: DirectoryCreationOptions): Promise<void> {
        await mkdir(this.resolvePath(path), {
            recursive: options?.recursive ?? false,
        });
    }

    public delete(path: string, options?: DeletionOptions): Promise<void> {
        return rm(this.resolvePath(path), {
            recursive: options?.recursive ?? false,
            force: true,
        });
    }

    public copyDirectory(source: string, destination: string, options?: DirectoryCopyOptions): Promise<void> {
        return cp(this.resolvePath(source), this.resolvePath(destination), {
            recursive: options?.recursive ?? false,
            force: options?.overwrite,
        });
    }

    private resolvePath(path: string): string {
        return isAbsolute(path) ? path : join(this.config.currentDirectory, path);
    }
}
