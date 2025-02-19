import {Resource, ResourceNotFoundError, ResourceProvider} from '@/application/provider/resource/resourceProvider';

export class MultiProvider<T> implements ResourceProvider<T> {
    private readonly providers: Array<ResourceProvider<T>>;

    public constructor(...providers: Array<ResourceProvider<T>>) {
        this.providers = providers;
    }

    public async supports(url: URL): Promise<boolean> {
        for (const provider of this.providers) {
            if (await provider.supports(url)) {
                return true;
            }
        }

        return false;
    }

    public async get(url: URL): Promise<Resource<T>> {
        for (const provider of this.providers) {
            if (!await provider.supports(url)) {
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
