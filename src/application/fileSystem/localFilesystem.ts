import {
    mkdir,
    rm,
    lstat,
    realpath,
    cp,
    readFile,
    writeFile,
    mkdtemp,
    rename,
    readdir,
} from 'fs/promises';
import {basename, dirname, isAbsolute, join, relative, sep} from 'path';
import {Glob} from 'glob';
import {tmpdir} from 'node:os';
import {extract} from 'tar';
import {
    DirectoryCopyOptions,
    DirectoryCreationOptions,
    DeletionOptions,
    FileSystem,
    FileWritingOptions,
    TarExtractionOptions,
    DirectoryMoveOptions,
} from '@/application/fileSystem/fileSystem';

export type Configuration = {
    currentDirectory: string,
    defaultEncoding: BufferEncoding,
};

export class LocalFilesystem implements FileSystem {
    private readonly config: Configuration;

    public constructor(configuration: Configuration) {
        this.config = configuration;
    }

    public getSeparator(): string {
        return sep;
    }

    public normalizeSeparators(path: string): string {
        return path.replace(/\//g, sep);
    }

    public getBaseName(path: string): string {
        return basename(path);
    }

    public getDirectoryName(path: string): string {
        return dirname(path);
    }

    public getRealPath(path: string): Promise<string> {
        return realpath(this.resolvePath(path));
    }

    public getRelativePath(from: string, to: string): string {
        return relative(from, to);
    }

    public isAbsolutePath(path: string): boolean {
        return isAbsolute(path);
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

    public async isEmptyDirectory(path: string): Promise<boolean> {
        const files = await readdir(this.resolvePath(path)).catch(() => []);

        return files.length === 0;
    }

    public joinPaths(...paths: string[]): string {
        return join(...paths);
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

    public delete(path: string, options?: DeletionOptions): Promise<void> {
        return rm(this.resolvePath(path), {
            recursive: options?.recursive ?? false,
            force: true,
        });
    }

    public find(pattern: string): AsyncGenerator<string, void, void> {
        const glob = new Glob(pattern, {
            cwd: this.config.currentDirectory,
            platform: process.platform,
        });

        return glob.iterate();
    }

    public readFile(path: string): Promise<string> {
        return readFile(this.resolvePath(path), this.config.defaultEncoding);
    }

    public async writeFile(path: string, data: string|Blob, options?: FileWritingOptions): Promise<void> {
        return writeFile(
            this.resolvePath(path),
            data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : data,
            {
                flag: options?.overwrite === true ? 'w' : 'wx',
                encoding: this.config.defaultEncoding,
            },
        );
    }

    public extractTar(tarball: string, destination: string, options?: TarExtractionOptions): Promise<void> {
        return extract({
            file: this.resolvePath(tarball),
            cwd: this.resolvePath(destination),
            gzip: options?.gzip,
            stripComponents: options?.stripComponents,
        });
    }

    public async createDirectory(path: string, options?: DirectoryCreationOptions): Promise<void> {
        await mkdir(this.resolvePath(path), {
            recursive: options?.recursive ?? false,
        });
    }

    public createTemporaryDirectory(): Promise<string> {
        return mkdtemp(tmpdir());
    }

    public copyDirectory(source: string, destination: string, options?: DirectoryCopyOptions): Promise<void> {
        return cp(this.resolvePath(source), this.resolvePath(destination), {
            recursive: options?.recursive ?? false,
            force: options?.overwrite ?? false,
        });
    }

    public async moveDirectoryContents(
        source: string,
        destination: string,
        options: DirectoryMoveOptions,
    ): Promise<void> {
        const files = await readdir(this.resolvePath(source));

        const promises: Array<Promise<void>> = [];

        for (const entry of files) {
            const sourcePath = this.resolvePath(join(source, entry));
            const destinationPath = this.resolvePath(join(destination, entry));

            if (await this.exists(destinationPath)) {
                if (options?.overwrite === true) {
                    await this.delete(destinationPath, {recursive: true});
                } else {
                    throw new Error(`Destination path already exists: ${destinationPath}`);
                }
            }

            promises.push(rename(this.resolvePath(sourcePath), this.resolvePath(destinationPath)));
        }

        await Promise.all(promises);
    }

    private resolvePath(path: string): string {
        return isAbsolute(path) ? path : join(this.config.currentDirectory, path);
    }
}
