import {ResourceNotFoundError, ResourceProvider, ProviderOptions} from '@/application/provider/resourceProvider';

export class MultiProvider<T, O extends ProviderOptions> implements ResourceProvider<T, O> {
    private readonly providers: Array<ResourceProvider<T, O>>;

    public constructor(provider: ResourceProvider<T, O>, ...providers: Array<ResourceProvider<T, O>>) {
        this.providers = [provider, ...providers];
    }

    public supports(url: URL): boolean {
        return this.providers.some(provider => provider.supports(url));
    }

    public get(url: URL, options?: O): Promise<T> {
        for (const provider of this.providers) {
            if (provider.supports(url)) {
                return provider.get(url, options);
            }
        }

        throw new ResourceNotFoundError('Resource not found.', url);
    }
}
