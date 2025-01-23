import {Readable} from 'stream';
import {ResourceProvider, ResourceProviderError} from '@/application/provider/resourceProvider';
import {FileSystemIterator} from '@/application/fs/fileSystem';
import {HttpProvider, SuccessResponse} from '@/application/template/provider/httpProvider';

export class HttpFileProvider implements ResourceProvider<FileSystemIterator> {
    private readonly provider: HttpProvider;

    public constructor(provider: HttpProvider) {
        this.provider = provider;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url) && url.pathname !== '/';
    }

    public async get(url: URL): Promise<FileSystemIterator> {
        if (!this.supports(url)) {
            throw new ResourceProviderError('Unsupported URL', url);
        }

        return this.yield(await this.provider.get(url), url);
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
