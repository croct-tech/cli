import {ResourceNotFoundError, ResourceProvider, ProviderOptions} from '@/application/provider/resourceProvider';

export class MultiProvider<T, O extends ProviderOptions> implements ResourceProvider<T, O> {
    private readonly providers: Array<ResourceProvider<T, O>>;

    public constructor(...providers: Array<ResourceProvider<T, O>>) {
        this.providers = providers;
    }

    public supports(url: URL): boolean {
        return this.providers.some(provider => provider.supports(url));
    }

    public async get(url: URL, options?: O): Promise<T> {
        for (const provider of this.providers) {
            if (!provider.supports(url)) {
                continue;
            }

            try {
                return await provider.get(url, options);
            } catch (error) {
                if (!(error instanceof ResourceNotFoundError)) {
                    throw error;
                }
            }
        }

        throw new ResourceNotFoundError('Resource not found.', {url: url});
    }
}
