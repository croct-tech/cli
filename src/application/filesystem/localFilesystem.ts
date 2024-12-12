import {
    mkdir,
    readFile,
    writeFile,
    rm,
    lstat,
    realpath,
    cp,
} from 'fs/promises';
import {
    DirectoryCopyOptions,
    DirectoryCreationOptions,
    DeletionOptions,
    Filesystem,
    FileWritingOptions,
} from '@/application/filesystem/filesystem';

export type DefaultOptions = {
    encoding: BufferEncoding,
};

export class LocalFilesystem implements Filesystem {
    private readonly defaultOptions: DefaultOptions;

    public constructor(defaultOptions: DefaultOptions) {
        this.defaultOptions = defaultOptions;
    }

    public getRealPath(path: string): Promise<string> {
        return realpath(path);
    }

    public async exists(path: string): Promise<boolean> {
        try {
            await lstat(path);

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
            return (await lstat(path)).isSymbolicLink();
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
                return false;
            }

            throw error;
        }
    }

    public async isDirectory(path: string): Promise<boolean> {
        try {
            return (await lstat(path)).isDirectory();
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }

            throw error;
        }
    }

    public readFile(path: string): Promise<string> {
        return readFile(path, this.defaultOptions.encoding);
    }

    public writeFile(path: string, content: string, options?: FileWritingOptions): Promise<void> {
        return writeFile(path, content, {
            flag: options?.overwrite === true ? 'w' : 'wx',
            encoding: this.defaultOptions.encoding,
        });
    }

    public async createDirectory(path: string, options?: DirectoryCreationOptions): Promise<void> {
        await mkdir(path, {
            recursive: options?.recursive,
        });
    }

    public delete(path: string, options?: DeletionOptions): Promise<void> {
        return rm(path, {
            recursive: options?.recursive,
            force: true,
        });
    }

    public copyDirectory(source: string, destination: string, options?: DirectoryCopyOptions): Promise<void> {
        return cp(source, destination, {
            recursive: options?.recursive,
            force: options?.overwrite,
        });
    }
}
