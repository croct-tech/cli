import {
    mkdir,
    rm,
    lstat,
    realpath,
    cp,
    readFile,
    writeFile,
    readdir,
    symlink,
    link,
} from 'fs/promises';
import {basename, dirname, isAbsolute, join, relative, sep} from 'path';
import {createReadStream} from 'fs';
import {Stats} from 'node:fs';
import {
    CopyOptions,
    DirectoryCreationOptions,
    DeletionOptions,
    FileSystem,
    FileWritingOptions,
    FileSystemEntry,
    FileSystemIterator,
} from '@/application/fs/fileSystem';
import {HelpfulError} from '@/application/error';
import {WorkingDirectory} from '@/application/fs/workingDirectory';

export type Configuration = {
    workingDirectory: WorkingDirectory,
    defaultEncoding: BufferEncoding,
};

export class LocalFilesystem implements FileSystem {
    private static readonly ERRORS = {
        ENOENT: 'The file or directory does not exist.',
        EACCES: 'Unable to access the file or directory.',
        EISDIR: 'Expected a file, but the path is a directory.',
        ENOTDIR: 'Expected a directory, but the path is a file.',
        EPERM: 'Operation not permitted.',
        EEXIST: 'The file or directory already exists.',
        ENOTEMPTY: 'The directory is not empty.',
    };

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
        return this.execute(() => realpath(this.resolvePath(path)));
    }

    public getRelativePath(from: string, to: string): string {
        return relative(this.resolvePath(from), this.resolvePath(to));
    }

    public isAbsolutePath(path: string): boolean {
        return isAbsolute(path);
    }

    public isSubPath(parent: string, path: string): boolean {
        const parentPath = this.resolvePath(parent);
        const subPath = isAbsolute(path) ? path : join(parentPath, path);
        const relativePath = relative(parentPath, subPath);

        return !relativePath.startsWith('..') && !isAbsolute(relativePath);
    }

    public isSymbolicLink(path: string): Promise<boolean> {
        return this.execute(
            async () => {
                try {
                    return (await lstat(this.resolvePath(path))).isSymbolicLink();
                } catch (error) {
                    if (LocalFilesystem.isErrorCode(error, ['ENOENT', 'ENOTDIR'])) {
                        return false;
                    }

                    throw error;
                }
            },
        );
    }

    public isDirectory(path: string): Promise<boolean> {
        return this.execute(
            async () => {
                try {
                    return (await lstat(this.resolvePath(path))).isDirectory();
                } catch (error) {
                    if (LocalFilesystem.isErrorCode(error, ['ENOENT', 'ENOTDIR'])) {
                        return false;
                    }

                    throw error;
                }
            },
        );
    }

    public isEmptyDirectory(path: string): Promise<boolean> {
        return this.execute(async () => (await readdir(this.resolvePath(path))).length === 0);
    }

    public create(entry: FileSystemEntry): Promise<void> {
        switch (entry.type) {
            case 'file':
                return this.execute(() => writeFile(this.resolvePath(entry.name), entry.content));

            case 'directory':
                return this.execute(() => mkdir(this.resolvePath(entry.name)));

            case 'link':
                return this.execute(() => link(entry.target, this.resolvePath(entry.name)));

            case 'symlink':
                return this.execute(() => symlink(entry.target, this.resolvePath(entry.name)));
        }
    }

    public list(path: string, recursive = false): FileSystemIterator {
        const root = this.resolvePath(path);

        return this.listRelatively(root, root, recursive);
    }

    private async* listRelatively(path: string, root: string, recursive = false): FileSystemIterator {
        const stats = await this.execute(() => lstat(path)).catch(() => null);

        if (stats === null) {
            return;
        }

        if (!stats.isDirectory()) {
            return yield* this.createEntry(path, dirname(root), stats, false);
        }

        const files = await this.execute(() => readdir(path));

        for (const entry of files) {
            const entryPath = join(path, entry);
            const entryStats = await this.execute(() => lstat(entryPath));

            yield* this.createEntry(entryPath, root, entryStats, recursive);
        }
    }

    private async* createEntry(path: string, root: string, stats: Stats, recursive: boolean): FileSystemIterator {
        const name = relative(root, path);

        if (stats.isFile()) {
            yield {
                type: 'file',
                name: name,
                content: await this.execute(() => createReadStream(path)),
            };
        } else if (stats.isDirectory()) {
            yield {
                type: 'directory',
                name: name,
            };

            if (recursive) {
                yield* this.listRelatively(path, root, recursive);
            }
        } else if (stats.isSymbolicLink()) {
            yield {
                type: 'symlink',
                name: name,
                target: await this.execute(() => realpath(path)),
            };
        } else {
            yield {
                type: 'link',
                name: name,
                target: await this.execute(() => realpath(path)),
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
            if (LocalFilesystem.isErrorCode(error, ['ENOENT', 'ENOTDIR'])) {
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

    public readTextFile(path: string): Promise<string> {
        return this.execute(() => readFile(this.resolvePath(path), this.config.defaultEncoding));
    }

    public writeTextFile(path: string, data: string, options?: FileWritingOptions): Promise<void> {
        return this.execute(
            () => writeFile(this.resolvePath(path), data, {
                flag: options?.overwrite === true ? 'w' : 'wx',
                encoding: this.config.defaultEncoding,
            }),
        );
    }

    public async createDirectory(path: string, options?: DirectoryCreationOptions): Promise<void> {
        await this.execute(
            () => mkdir(this.resolvePath(path), {
                recursive: options?.recursive ?? false,
            }),
        );
    }

    public copy(source: string, destination: string, options?: CopyOptions): Promise<void> {
        return this.execute(
            () => cp(this.resolvePath(source), this.resolvePath(destination), {
                recursive: options?.recursive ?? false,
                force: options?.overwrite ?? false,
            }),
        );
    }

    private resolvePath(path: string): string {
        return isAbsolute(path) ? path : join(this.config.workingDirectory.get(), path);
    }

    private async execute<T>(action: () => Promise<T>|T): Promise<T> {
        try {
            return await action();
        } catch (error) {
            LocalFilesystem.reportError(error);
        }
    }

    private static reportError(error: unknown): never {
        if (error instanceof Error) {
            for (const [code, message] of Object.entries(LocalFilesystem.ERRORS)) {
                if (LocalFilesystem.isErrorCode(error, [code])) {
                    throw new HelpfulError(message, {
                        cause: error,
                    });
                }
            }
        }

        throw error;
    }

    private static isErrorCode(error: unknown, codes: string[]): error is Error {
        if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'string') {
            return false;
        }

        return codes.includes(error.code);
    }
}
