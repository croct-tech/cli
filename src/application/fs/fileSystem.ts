import {Readable} from 'stream';

export type FileWritingOptions = {
    overwrite?: boolean,
};

export type DirectoryCreationOptions = {
    recursive?: boolean,
};

export type CopyOptions = {
    recursive?: boolean,
    overwrite?: boolean,
};

export type DirectoryMoveOptions = {
    overwrite?: boolean,
};

export type DeletionOptions = {
    recursive?: boolean,
};

type FileSystemEntries = {
    file: {
        content: Readable,
    },
    directory: Record<never, never>,
    link: {
        target: string,
    },
    symlink: {
        target: string,
    },
};

export type FileSystemEntryType = keyof FileSystemEntries;

export type FileSystemEntry<T extends FileSystemEntryType = FileSystemEntryType> = {
    [K in T]: FileSystemEntries[K] & {
        type: K,
        name: string,
    }
}[T];

export type FileSystemIterator = AsyncGenerator<FileSystemEntry, void, void>;

export interface FileSystem {
    getSeparator(): string;
    normalizeSeparators(path: string): string;
    getRealPath(path: string): Promise<string>;
    exists(path: string): Promise<boolean>;
    delete(path: string, options?: DeletionOptions): Promise<void>;
    readTextFile(path: string): Promise<string>;
    writeTextFile(path: string, data: string, options?: FileWritingOptions): Promise<void>;
    isAbsolutePath(path: string): boolean;
    isSubPath(parent: string, path: string): boolean;
    joinPaths(...paths: string[]): string;
    getBaseName(path: string): string;
    getRelativePath(from: string, to: string): string;
    isSymbolicLink(path: string): Promise<boolean>;
    isDirectory(path: string): Promise<boolean>;
    getDirectoryName(path: string): string;
    createDirectory(path: string, options?: DirectoryCreationOptions): Promise<void>;
    copy(source: string, destination: string, options?: CopyOptions): Promise<void>;
    isEmptyDirectory(path: string): Promise<boolean>;
    create(entry: FileSystemEntry): Promise<void>;
    list(path: string, recursive?: boolean): FileSystemIterator;
    find(pattern: string): FileSystemIterator;
}
