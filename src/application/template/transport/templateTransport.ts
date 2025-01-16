import {NotFoundError, Transport, TransportOptions} from '@/application/template/transport/transport';
import {Template} from '@/application/template/template';
import {JsonParser} from '@/infrastructure/json';
import {FileSystemIterator} from '@/application/fs/fileSystem';

export type Adapter<I, R> = (value: I, url: URL) => Promise<R>;

export type Configuration<I, R, O extends TransportOptions> = {
    transport: Transport<I, O>,
    adapter: Adapter<I, R>,
};

export class TemplateTransport<O extends TransportOptions> implements Transport<Template, O> {
    private readonly transport: Transport<FileSystemIterator, O>;

    public constructor(transport: Transport<FileSystemIterator, O>) {
        this.transport = transport;
    }

    public supports(url: URL): boolean {
        return this.transport.supports(url);
    }

    public async fetch(url: URL, options?: O): Promise<Template> {
        const iterator = await this.transport.fetch(url, options);
        const next = await iterator.next();

        if (next.done === true || next.value.type !== 'file') {
            throw new NotFoundError('Template not found.');
        }

        // @todo add validation
        const source = await new Response(next.value.content).text();

        return JsonParser.parse(source).toJSON() as Template;
    }
}
