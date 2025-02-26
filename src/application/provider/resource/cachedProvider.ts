import {CacheProvider} from '@croct/cache';
import {Resource, ResourceProvider} from '@/application/provider/resource/resourceProvider';

export type Configuration<T> = {
    provider: ResourceProvider<T>,
    errorCache?: CacheProvider<string, any>,
    resourceCache: CacheProvider<string, Resource<T>>,
};

export class CachedProvider<T> implements ResourceProvider<T> {
    private readonly provider: ResourceProvider<T>;

    private readonly resourceCache: CacheProvider<string, Resource<T>>;

    private readonly errorCache?: CacheProvider<string, any>;

    public constructor({provider, resourceCache, errorCache}: Configuration<T>) {
        this.provider = provider;
        this.resourceCache = resourceCache;
        this.errorCache = errorCache;
    }

    public async get(url: URL): Promise<Resource<T>> {
        const cachedError = await this.errorCache?.get(url.toString(), () => Promise.resolve());

        if (cachedError !== undefined) {
            return Promise.reject(cachedError);
        }

        return this.resourceCache.get(url.toString(), async () => {
            try {
                return await this.provider.get(url);
            } catch (error) {
                this.errorCache?.set(url.toString(), error);

                throw error;
            }
        });
    }
}
