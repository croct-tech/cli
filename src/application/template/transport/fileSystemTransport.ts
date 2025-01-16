import {Transport, TransportError} from '@/application/template/transport/transport';
import {FileSystem, FileSystemIterator} from '@/application/fs/fileSystem';

export class FileSystemTransport implements Transport<FileSystemIterator> {
    private readonly fileSystem: FileSystem;

    public constructor(fileSystem: FileSystem) {
        this.fileSystem = fileSystem;
    }

    public supports(url: URL): boolean {
        return url.protocol === 'file:';
    }

    public fetch(url: URL): Promise<FileSystemIterator> {
        if (!this.supports(url)) {
            throw new TransportError('Unsupported protocol');
        }

        return Promise.resolve(this.fileSystem.list(this.fileSystem.normalizeSeparators(url.pathname)));
    }
}
