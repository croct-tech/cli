import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resourceProvider';
import {FileSystem, FileSystemIterator} from '@/application/fs/fileSystem';

export class FileSystemProvider implements ResourceProvider<FileSystemIterator> {
    private readonly fileSystem: FileSystem;

    public constructor(fileSystem: FileSystem) {
        this.fileSystem = fileSystem;
    }

    public supports(url: URL): boolean {
        return url.protocol === 'file:';
    }

    public get(url: URL): Promise<Resource<FileSystemIterator>> {
        if (!this.supports(url)) {
            throw new ResourceProviderError('Unsupported protocol.', {url: url});
        }

        return Promise.resolve({
            url: url,
            value: this.fileSystem.list(this.fileSystem.normalizeSeparators(url.pathname)),
        });
    }
}
