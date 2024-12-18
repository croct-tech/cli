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

export type DeletionOptions = {
    recursive?: boolean,
};

export interface Filesystem {
    getRealPath(path: string): Promise<string>;
    getSeparator(): string;
    isAbsolute(path: string): boolean;
    joinPaths(...paths: string[]): string;
    getBaseName(path: string): string;
    getRelativePath(from: string, to: string): string;
    isSymbolicLink(path: string): Promise<boolean>;
    isDirectory(path: string): Promise<boolean>;
    getDirectoryName(path: string): string;
    exists(path: string): Promise<boolean>;
    delete(path: string, options?: DeletionOptions): Promise<void>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string, options?: FileWritingOptions): Promise<void>;
    createDirectory(path: string, options?: DirectoryCreationOptions): Promise<void>;
    copyDirectory(source: string, destination: string, options?: DirectoryCopyOptions): Promise<void>;
}
