import {CacheProvider} from '@croct/cache';
import {Resource, ResourceProvider} from '@/application/provider/resourceProvider';

export type Configuration<T> = {
    provider: ResourceProvider<T>,
    cache: CacheProvider<string, Resource<T>>,
};

export class CachedProvider<T> implements ResourceProvider<T> {
    private readonly provider: ResourceProvider<T>;

    private readonly cache: CacheProvider<string, Resource<T>>;

    public constructor({provider, cache}: Configuration<T>) {
        this.provider = provider;
        this.cache = cache;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public get(url: URL): Promise<Resource<T>> {
        return this.cache.get(url.toString(), () => this.provider.get(url));
    }
}
