import {NotFoundError, Provider, ProviderOptions} from '@/application/template/provider/provider';
import {FileSystemIterator} from '@/application/fs/fileSystem';

export class FileContentProvider<O extends ProviderOptions> implements Provider<string, O> {
    private readonly provider: Provider<FileSystemIterator, O>;

    public constructor(provider: Provider<FileSystemIterator, O>) {
        this.provider = provider;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public async get(url: URL, options?: O): Promise<string> {
        const iterator = await this.provider.get(url, options);
        const next = await iterator.next();

        if (next.done === true || next.value.type !== 'file') {
            throw new NotFoundError('File not found.', url);
        }

        return new Response(next.value.content).text();
    }
}
