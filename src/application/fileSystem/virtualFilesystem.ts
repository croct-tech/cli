import {basename, dirname, isAbsolute, join, relative, sep} from 'path';
import {
    DeletionOptions,
    DirectoryCopyOptions,
    DirectoryCreationOptions,
    FileSystem,
    FileWritingOptions,
} from '@/application/fileSystem/fileSystem';

type FilesystemNodeMap = {
    file: {
        content: string|Blob,
    },
    link: {
        target: string,
    },
    directory: {
        files: Record<string, FilesystemNode>,
    },
};

type FilesystemNodeType = keyof FilesystemNodeMap;

type FilesystemNode<T extends FilesystemNodeType = FilesystemNodeType> = {
    [K in T]: FilesystemNodeMap[K] & {
        type: K,
    }
}[T];

export class VirtualFilesystem implements FileSystem {
    private readonly root: FilesystemNode<'directory'>;

    public constructor(root: FilesystemNode<'directory'>) {
        this.root = {...root};
    }

    public find(pattern: string): AsyncGenerator<string, void, void> {
        throw new Error('Method not implemented');
    }

    public getSeparator(): string {
        return sep;
    }

    public joinPaths(...paths: string[]): string {
        return join(...paths);
    }

    public getBaseName(path: string): string {
        return basename(path);
    }

    public getDirectoryName(path: string): string {
        return dirname(path);
    }

    public getRelativePath(from: string, to: string): string {
        return relative(from, to);
    }

    public isAbsolutePath(path: string): boolean {
        return isAbsolute(path);
    }

    public getRealPath(path: string): Promise<string> {
        const node = this.getNode(path);

        if (node === null) {
            return Promise.reject(new Error('Path not found'));
        }

        if (node.type === 'link') {
            return Promise.resolve(node.target);
        }

        return Promise.resolve(path);
    }

    public exists(path: string): Promise<boolean> {
        return Promise.resolve(this.getNode(path) !== null);
    }

    public isSymbolicLink(path: string): Promise<boolean> {
        return Promise.resolve(this.getNode(path)?.type === 'link');
    }

    public isDirectory(path: string): Promise<boolean> {
        return Promise.resolve(this.getNode(path)?.type === 'directory');
    }

    public delete(path: string, options?: DeletionOptions): Promise<void> {
        const node = this.getParentNode(path);

        if (node !== null) {
            if (Object.keys(node.files).length > 0 && options?.recursive !== true) {
                return Promise.reject(new Error('Directory not empty'));
            }

            delete node.files[path.split(this.getSeparator()).pop() as string];
        }

        return Promise.resolve();
    }

    public readFile(path: string): Promise<string> {
        const node = this.getNode(path);

        if (node === null || node.type !== 'file') {
            return Promise.reject(new Error('File not found'));
        }

        return Promise.resolve(node.content);
    }

    public writeFile(path: string, data: string|Blob, options?: FileWritingOptions): Promise<void> {
        const directory = this.getParentNode(path);

        if (directory === null) {
            return Promise.reject(new Error('Directory not found'));
        }

        const fileName = path.split(this.getSeparator()).pop() as string;

        if (options?.overwrite !== true && fileName in directory.files) {
            return Promise.reject(new Error('File already exists'));
        }

        directory.files[fileName] = {
            type: 'file',
            content: data,
        };

        return Promise.resolve();
    }

    public createDirectory(path: string, options?: DirectoryCreationOptions): Promise<void> {
        try {
            this.createDirectoryNode(path, options);

            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    public copyDirectory(source: string, destination: string, options?: DirectoryCopyOptions): Promise<void> {
        const sourceNode = this.getNode(source);

        if (sourceNode === null || sourceNode.type !== 'directory') {
            return Promise.reject(new Error('Source directory not found'));
        }

        let destinationNode = this.getParentNode(destination);

        if (destinationNode === null) {
            if (options?.recursive !== true) {
                return Promise.reject(new Error('Destination directory not found'));
            }

            try {
                destinationNode = this.createDirectoryNode(destination, options);
            } catch (error) {
                return Promise.reject(error);
            }
        }

        destinationNode.files[destination.split(this.getSeparator()).pop() as string] = {
            type: 'directory',
            files: {...sourceNode.files},
        };

        return Promise.resolve();
    }

    private createDirectoryNode(path: string, options?: DirectoryCreationOptions): FilesystemNode<'directory'> {
        const separator = this.getSeparator();
        const segments = path.split(separator);
        const node: FilesystemNode<'directory'> = this.root;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];

            if (node === null || node.type !== 'directory') {
                throw new Error('Directory not found');
            }

            if (segment in node.files) {
                const file = node.files[segment];

                if (file.type !== 'directory') {
                    throw new Error(`File ${segments.slice(0, i).join(separator)} already exists`);
                }

                continue;
            }

            if (options?.recursive !== true) {
                throw new Error(`Directory ${segments.slice(0, i).join(separator)} not found`);
            }

            node.files[segment] = {
                type: 'directory',
                files: {},
            };
        }

        return node;
    }

    private getParentNode(path: string): FilesystemNode<'directory'> | null {
        const separator = this.getSeparator();

        if (!path.includes(separator)) {
            return this.root;
        }

        const parts = path.split(separator);
        const parentPath = parts.slice(0, -1).join(separator);
        const directory = this.getNode(parentPath);

        if (directory === null || directory.type !== 'directory') {
            return null;
        }

        return directory;
    }

    private getNode(path: string): FilesystemNode | null {
        const segments = path.split(this.getSeparator());

        const node: FilesystemNode = this.root;

        for (const segment of segments) {
            if (node.type !== 'directory') {
                return null;
            }

            if (!(segment in node.files)) {
                return null;
            }
        }

        return node;
    }
}
