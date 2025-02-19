import {Resource, ResourceNotFoundError, ResourceProvider} from '@/application/provider/resource/resourceProvider';
import {FileSystemIterator} from '@/application/fs/fileSystem';

export class FileContentProvider implements ResourceProvider<string> {
    private readonly provider: ResourceProvider<FileSystemIterator>;

    public constructor(provider: ResourceProvider<FileSystemIterator>) {
        this.provider = provider;
    }

    public supports(url: URL): Promise<boolean> {
        return this.provider.supports(url);
    }

    public async get(url: URL): Promise<Resource<string>> {
        const {value: iterator, ...resource} = await this.provider.get(url);
        const next = await iterator.next();

        if (next.done === true || next.value.type !== 'file') {
            throw new ResourceNotFoundError('File not found.', {url: url});
        }

        return {
            ...resource,
            value: await new Response(next.value.content).text(),
        };
    }
}
