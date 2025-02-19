import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resource/resourceProvider';
import {FileSystem, FileSystemIterator} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';

export class FileSystemProvider implements ResourceProvider<FileSystemIterator> {
    private readonly fileSystem: FileSystem;

    public constructor(fileSystem: FileSystem) {
        this.fileSystem = fileSystem;
    }

    public supports(url: URL): Promise<boolean> {
        return Promise.resolve(FileSystemProvider.supportsUrl(url));
    }

    public get(url: URL): Promise<Resource<FileSystemIterator>> {
        if (!FileSystemProvider.supportsUrl(url)) {
            throw new ResourceProviderError(`Unsupported protocol "${url.protocol}".`, {
                reason: ErrorReason.PRECONDITION,
                url: url,
            });
        }

        return Promise.resolve({
            url: url,
            value: this.fileSystem.list(this.fileSystem.normalizeSeparators(url.pathname)),
        });
    }

    private static supportsUrl(url: URL): boolean {
        return url.protocol === 'file:';
    }
}
