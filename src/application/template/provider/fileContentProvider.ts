import {ResourceNotFoundError, ResourceProvider, ProviderOptions} from '@/application/provider/resourceProvider';
import {FileSystemIterator} from '@/application/fs/fileSystem';

export class FileContentProvider<O extends ProviderOptions> implements ResourceProvider<string, O> {
    private readonly provider: ResourceProvider<FileSystemIterator, O>;

    public constructor(provider: ResourceProvider<FileSystemIterator, O>) {
        this.provider = provider;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public async get(url: URL, options?: O): Promise<string> {
        const iterator = await this.provider.get(url, options);
        const next = await iterator.next();

        if (next.done === true || next.value.type !== 'file') {
            throw new ResourceNotFoundError('File not found.', {url: url});
        }

        return new Response(next.value.content).text();
    }
}
