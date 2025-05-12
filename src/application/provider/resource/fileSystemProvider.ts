import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resource/resourceProvider';
import {FileSystem, FileSystemIterator, ScanFilter} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';

export class FileSystemProvider implements ResourceProvider<FileSystemIterator> {
    private readonly fileSystem: FileSystem;

    private readonly filter?: ScanFilter;

    public constructor(fileSystem: FileSystem, filter?: ScanFilter) {
        this.fileSystem = fileSystem;
        this.filter = filter;
    }

    public get(url: URL): Promise<Resource<FileSystemIterator>> {
        if (!FileSystemProvider.supportsUrl(url)) {
            throw new ResourceProviderError(`Unsupported protocol "${url.protocol}".`, {
                reason: ErrorReason.NOT_SUPPORTED,
                url: url,
            });
        }

        return Promise.resolve({
            url: url,
            value: this.fileSystem.list(this.fileSystem.normalizeSeparators(url.pathname), this.filter),
        });
    }

    private static supportsUrl(url: URL): boolean {
        return url.protocol === 'file:';
    }
}
