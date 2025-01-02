export type FileWritingOptions = {
    overwrite?: boolean,
};

export type DirectoryCreationOptions = {
    recursive?: boolean,
};

export type DirectoryCopyOptions = {
    recursive?: boolean,
    overwrite?: boolean,
};

export type DirectoryMoveOptions = {
    overwrite?: boolean,
};

export type DeletionOptions = {
    recursive?: boolean,
};

export type TarExtractionOptions = {
    stripComponents?: number,
    gzip?: boolean,
};

export interface FileSystem {
    getSeparator(): string;
    normalizeSeparators(path: string): string;
    getRealPath(path: string): Promise<string>;
    exists(path: string): Promise<boolean>;
    delete(path: string, options?: DeletionOptions): Promise<void>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, data: string|Blob, options?: FileWritingOptions): Promise<void>;
    find(pattern: string): AsyncGenerator<string, void, void>;
    extractTar(tarball: string, destination: string, options?: TarExtractionOptions): Promise<void>;
    isAbsolutePath(path: string): boolean;
    joinPaths(...paths: string[]): string;
    getBaseName(path: string): string;
    getRelativePath(from: string, to: string): string;
    isSymbolicLink(path: string): Promise<boolean>;
    isDirectory(path: string): Promise<boolean>;
    getDirectoryName(path: string): string;
    createDirectory(path: string, options?: DirectoryCreationOptions): Promise<void>;
    createTemporaryDirectory(): Promise<string>;
    copyDirectory(source: string, destination: string, options?: DirectoryCopyOptions): Promise<void>;
    moveDirectoryContents(source: string, destination: string, options?: DirectoryMoveOptions): Promise<void>;
    isEmptyDirectory(path: string): Promise<boolean>;
}
