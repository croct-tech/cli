import {Resource, ResourceNotFoundError, ResourceProvider} from '@/application/provider/resourceProvider';

export class MultiProvider<T> implements ResourceProvider<T> {
    private readonly providers: Array<ResourceProvider<T>>;

    public constructor(...providers: Array<ResourceProvider<T>>) {
        this.providers = providers;
    }

    public supports(url: URL): boolean {
        return this.providers.some(provider => provider.supports(url));
    }

    public async get(url: URL): Promise<Resource<T>> {
        for (const provider of this.providers) {
            if (!provider.supports(url)) {
                continue;
            }

            try {
                return await provider.get(url);
            } catch (error) {
                if (!(error instanceof ResourceNotFoundError)) {
                    throw error;
                }
            }
        }

        throw new ResourceNotFoundError('Resource not found.', {url: url});
    }
}
