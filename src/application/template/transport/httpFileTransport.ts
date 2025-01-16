import {Readable} from 'stream';
import {Transport, TransportError} from '@/application/template/transport/transport';
import {FileSystemIterator} from '@/application/fs/fileSystem';
import {HttpTransport, SuccessResponse} from '@/application/template/transport/httpTransport';

export class HttpFileTransport implements Transport<FileSystemIterator> {
    private readonly transport: HttpTransport;

    public constructor(transport: HttpTransport) {
        this.transport = transport;
    }

    public supports(url: URL): boolean {
        return this.transport.supports(url) && url.pathname !== '/';
    }

    public async fetch(url: URL): Promise<FileSystemIterator> {
        if (!this.supports(url)) {
            throw new TransportError('Unsupported URL');
        }

        return this.yield(await this.transport.fetch(url), url);
    }

    private async* yield(response: SuccessResponse, url: URL): FileSystemIterator {
        yield {
            type: 'file',
            name: url.pathname
                .split('/')
                .pop()!,
            content: Readable.fromWeb(response.body!),
        };
    }
}
