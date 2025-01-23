import {CacheProvider} from '@croct/cache';
import {ResourceProvider, ProviderOptions} from '@/application/provider/resourceProvider';

export type Configuration<T, O extends ProviderOptions> = {
    provider: ResourceProvider<T, O>,
    cache: CacheProvider<string, T>,
};

export class CachedProvider<T, O extends ProviderOptions> implements ResourceProvider<T, O> {
    private readonly provider: ResourceProvider<T, O>;

    private readonly cache: CacheProvider<string, T>;

    public constructor({provider, cache}: Configuration<T, O>) {
        this.provider = provider;
        this.cache = cache;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public get(url: URL, options?: O): Promise<T> {
        return this.cache.get(url.toString(), () => this.provider.get(url, options));
    }
}
