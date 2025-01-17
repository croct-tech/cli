import {Provider, ProviderError} from '@/application/template/provider/provider';
import {FileSystem, FileSystemIterator} from '@/application/fs/fileSystem';

export class FileSystemProvider implements Provider<FileSystemIterator> {
    private readonly fileSystem: FileSystem;

    public constructor(fileSystem: FileSystem) {
        this.fileSystem = fileSystem;
    }

    public supports(url: URL): boolean {
        return url.protocol === 'file:';
    }

    public get(url: URL): Promise<FileSystemIterator> {
        if (!this.supports(url)) {
            throw new ProviderError('Unsupported protocol.', url);
        }

        return Promise.resolve(this.fileSystem.list(this.fileSystem.normalizeSeparators(url.pathname)));
    }
}
