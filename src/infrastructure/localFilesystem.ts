import {
    mkdir,
    readFile,
    writeFile,
    lstat,
    realpath,
    unlink,
    cp,
} from 'fs/promises';
import {DirectoryCopyOptions, DirectoryCreationOptions, Filesystem, FileWritingOptions} from '@/application/filesystem';

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
            if (error.code === 'ENOENT') {
                return false;
            }

            throw error;
        }
    }

    public async isSymbolicLink(path: string): Promise<boolean> {
        try {
            return (await lstat(path)).isSymbolicLink();
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }

            throw error;
        }
    }

    public unlink(path: string): Promise<void> {
        return unlink(path);
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

    public copyDirectory(source: string, destination: string, options?: DirectoryCopyOptions): Promise<void> {
        return cp(source, destination, {
            recursive: options?.recursive,
        });
    }
}
