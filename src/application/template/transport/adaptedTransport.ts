import {Transport, TransportOptions} from '@/application/template/transport/transport';

export type Adapter<I, R> = (value: I, url: URL) => Promise<R>;

export type Configuration<I, R, O extends TransportOptions> = {
    transport: Transport<I, O>,
    adapter: Adapter<I, R>,
};

export class AdaptedTransport<I, R, O extends TransportOptions> implements Transport<R, O> {
    private readonly transport: Transport<I, O>;

    private readonly adapter: Adapter<I, R>;

    public constructor({adapter, transport}: Configuration<I, R, O>) {
        this.adapter = adapter;
        this.transport = transport;
    }

    public supports(url: URL): boolean {
        return this.transport.supports(url);
    }

    public async fetch(url: URL, options?: O): Promise<R> {
        return this.adapter(await this.transport.fetch(url, options), url);
    }
}
