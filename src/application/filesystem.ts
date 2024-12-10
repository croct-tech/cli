export type FileWritingOptions = {
    overwrite?: boolean,
};

export type DirectoryCreationOptions = {
    recursive?: boolean,
};

export type DirectoryCopyOptions = {
    recursive?: boolean,
};

export interface Filesystem {
    getRealPath(path: string): Promise<string>;
    isSymbolicLink(path: string): Promise<boolean>;
    exists(path: string): Promise<boolean>;
    unlink(path: string): Promise<void>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string, options?: FileWritingOptions): Promise<void>;
    createDirectory(path: string, options?: DirectoryCreationOptions): Promise<void>;
    copyDirectory(source: string, destination: string, options?: DirectoryCopyOptions): Promise<void>;
}
