import {Readable} from 'stream';
import {Resource, ResourceProvider, ResourceProviderError} from '@/application/provider/resource/resourceProvider';
import {FileSystemIterator} from '@/application/fs/fileSystem';
import {HttpProvider, SuccessResponse} from '@/application/provider/resource/httpProvider';
import {ErrorReason} from '@/application/error';

export class HttpFileProvider implements ResourceProvider<FileSystemIterator> {
    private readonly provider: HttpProvider;

    public constructor(provider: HttpProvider) {
        this.provider = provider;
    }

    public supports(url: URL): Promise<boolean> {
        if (!HttpFileProvider.supportsUrl(url)) {
            return Promise.resolve(false);
        }

        return this.provider.supports(url);
    }

    public async get(url: URL): Promise<Resource<FileSystemIterator>> {
        if (!HttpFileProvider.supportsUrl(url)) {
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

    private static supportsUrl(url: URL): boolean {
        return url.pathname !== '/';
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
