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
    symlink,
    link,
} from 'fs/promises';
import {basename, dirname, isAbsolute, join, relative, sep} from 'path';
import {createReadStream} from 'fs';
import {Glob} from 'glob';
import {tmpdir} from 'node:os';
import {Stats} from 'node:fs';
import {
    CopyOptions,
    DirectoryCreationOptions,
    DeletionOptions,
    FileSystem,
    FileWritingOptions,
    DirectoryMoveOptions,
    FileSystemEntry,
    FileSystemIterator,
} from '@/application/fs/fileSystem';

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

    public isSubPath(parent: string, path: string): boolean {
        const parentPath = this.resolvePath(parent);
        const subPath = isAbsolute(path) ? path : join(parentPath, path);
        const relativePath = relative(parent, subPath);

        return !relativePath.startsWith('..') && !isAbsolute(relativePath);
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

    public create(entry: FileSystemEntry): Promise<void> {
        switch (entry.type) {
            case 'file':
                return writeFile(this.resolvePath(entry.name), entry.content);

            case 'directory':
                return mkdir(this.resolvePath(entry.name));

            case 'link':
                return link(entry.target, this.resolvePath(entry.name));

            case 'symlink':
                return symlink(entry.target, this.resolvePath(entry.name));
        }
    }

    public async* list(path: string, recursive = false): FileSystemIterator {
        const stats = await lstat(this.resolvePath(path));

        if (!stats.isDirectory()) {
            return yield* this.createEntry(path, stats, recursive);
        }

        const files = await readdir(this.resolvePath(path));

        for (const entry of files) {
            const entryPath = this.joinPaths(path, entry);

            yield* this.createEntry(entryPath, await lstat(entryPath), recursive);
        }
    }

    private async* createEntry(path: string, stats: Stats, recursive: boolean): FileSystemIterator {
        if (stats.isFile()) {
            yield {
                type: 'file',
                name: path,
                content: createReadStream(path),
            };
        } else if (stats.isDirectory()) {
            yield {
                type: 'directory',
                name: path,
            };

            if (recursive) {
                yield* this.list(path, recursive);
            }
        } else if (stats.isSymbolicLink()) {
            yield {
                type: 'symlink',
                name: path,
                target: await realpath(path),
            };
        } else {
            yield {
                type: 'link',
                name: path,
                target: await realpath(path),
            };
        }
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

    public async* find(pattern: string): FileSystemIterator {
        const glob = new Glob(pattern, {
            cwd: this.config.currentDirectory,
            platform: process.platform,
        });

        for await (const file of glob) {
            yield* this.createEntry(file, await lstat(file), false);
        }
    }

    public readTextFile(path: string): Promise<string> {
        return readFile(this.resolvePath(path), this.config.defaultEncoding);
    }

    public writeTextFile(path: string, data: string, options?: FileWritingOptions): Promise<void> {
        return writeFile(this.resolvePath(path), data, {
            flag: options?.overwrite === true ? 'w' : 'wx',
            encoding: this.config.defaultEncoding,
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

    public copy(source: string, destination: string, options?: CopyOptions): Promise<void> {
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
