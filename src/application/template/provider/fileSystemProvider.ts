import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resourceProvider';
import {FileSystem, FileSystemIterator} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';

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
            throw new ResourceProviderError(`Unsupported protocol "${url.protocol}".`, {
                reason: ErrorReason.PRECONDITION,
                url: url,
            });
        }

        return Promise.resolve({
            url: url,
            value: this.fileSystem.list(this.fileSystem.normalizeSeparators(url.pathname), true),
        });
    }
}
