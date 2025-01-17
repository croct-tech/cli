import {CacheProvider} from '@croct/cache';
import {Provider, ProviderOptions} from '@/application/template/provider/provider';

export type Configuration<T, O extends ProviderOptions> = {
    provider: Provider<T, O>,
    cache: CacheProvider<string, T>,
};

export class CachedProvider<T, O extends ProviderOptions> implements Provider<T, O> {
    private readonly provider: Provider<T, O>;

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
