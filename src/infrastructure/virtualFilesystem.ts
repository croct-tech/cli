import {DirectoryCopyOptions, DirectoryCreationOptions, Filesystem, FileWritingOptions} from '@/application/filesystem';

type FilesystemNodeMap = {
    file: {
        content: string,
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

export class VirtualFilesystem implements Filesystem {
    private readonly root: FilesystemNode<'directory'>;

    public constructor(root: FilesystemNode<'directory'>) {
        this.root = {...root};
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

    public unlink(path: string): Promise<void> {
        const directory = this.getParentNode(path);

        if (directory !== null) {
            delete directory.files[path.split('/').pop() as string];
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

    public writeFile(path: string, content: string, options?: FileWritingOptions): Promise<void> {
        const directory = this.getParentNode(path);

        if (directory === null) {
            return Promise.reject(new Error('Directory not found'));
        }

        const fileName = path.split('/').pop() as string;

        if (options?.overwrite !== true && directory.files[fileName] !== undefined) {
            return Promise.reject(new Error('File already exists'));
        }

        directory.files[fileName] = {
            type: 'file',
            content: content,
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

        destinationNode.files[destination.split('/').pop() as string] = {
            type: 'directory',
            files: {...sourceNode.files},
        };

        return Promise.resolve();
    }

    private createDirectoryNode(path: string, options?: DirectoryCreationOptions): FilesystemNode<'directory'> {
        const parts = path.split('/');

        const node: FilesystemNode<'directory'> = this.root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (node === null || node.type !== 'directory') {
                throw new Error('Directory not found');
            }

            if (node.files[part] !== undefined) {
                const file = node.files[part];

                if (file.type !== 'directory') {
                    throw new Error(`File ${parts.slice(0, i).join('/')} already exists`);
                }

                continue;
            }

            if (options?.recursive !== true) {
                throw new Error(`Directory ${parts.slice(0, i).join('/')} not found`);
            }

            node.files[part] = {
                type: 'directory',
                files: {},
            };
        }

        return node;
    }

    private getParentNode(path: string): FilesystemNode<'directory'> | null {
        if (!path.includes('/')) {
            return this.root;
        }

        const parts = path.split('/');
        const parentPath = parts.slice(0, -1).join('/');
        const directory = this.getNode(parentPath);

        if (directory === null || directory.type !== 'directory') {
            return null;
        }

        return directory;
    }

    private getNode(path: string): FilesystemNode | null {
        const parts = path.split('/');

        let node: FilesystemNode = this.root;

        for (const part of parts) {
            if (node.type !== 'directory') {
                return null;
            }

            node = node.files[part];

            if (node === undefined) {
                return null;
            }
        }

        return node;
    }
}
