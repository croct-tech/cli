import {Readable} from 'stream';
import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resourceProvider';
import {FileSystemIterator} from '@/application/fs/fileSystem';
import {HttpProvider, SuccessResponse} from '@/application/template/provider/httpProvider';
import {ErrorReason} from '@/application/error';

export class HttpFileProvider implements ResourceProvider<FileSystemIterator> {
    private readonly provider: HttpProvider;

    public constructor(provider: HttpProvider) {
        this.provider = provider;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url) && url.pathname !== '/';
    }

    public async get(url: URL): Promise<Resource<FileSystemIterator>> {
        if (!this.supports(url)) {
            throw new ResourceProviderError('Unsupported URL.', {
                reason: ErrorReason.NOT_SUPPORTED,
                url: url,
            });
        }

        const {value, ...resource} = await this.provider.get(url);

        return {
            ...resource,
            value: this.yield(value, url),
        };
    }

    private async* yield(response: SuccessResponse, url: URL): FileSystemIterator {
        yield {
            type: 'file',
            name: url.pathname
                .split('/')
                .pop()!,
            content: Readable.fromWeb(response.body),
        };
    }
}
