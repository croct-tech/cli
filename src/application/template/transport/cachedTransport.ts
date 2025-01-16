import {CacheProvider} from '@croct/cache';
import {Transport, TransportOptions} from '@/application/template/transport/transport';

export type Configuration<T, O extends TransportOptions> = {
    transport: Transport<T, O>,
    cache: CacheProvider<string, T>,
};

export class CachedTransport<T, O extends TransportOptions> implements Transport<T, O> {
    private readonly transport: Transport<T, O>;

    private readonly cache: CacheProvider<string, T>;

    public constructor(config: Configuration<T, O>) {
        this.transport = config.transport;
        this.cache = config.cache;
    }

    public supports(url: URL): boolean {
        return this.transport.supports(url);
    }

    public fetch(url: URL, options?: O): Promise<T> {
        return this.cache.get(url.toString(), () => this.transport.fetch(url, options));
    }
}
