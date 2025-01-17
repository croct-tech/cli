import {NotFoundError, Provider, ProviderOptions} from '@/application/template/provider/provider';

export class MultiProvider<T, O extends ProviderOptions> implements Provider<T, O> {
    private readonly providers: Array<Provider<T, O>>;

    public constructor(provider: Provider<T, O>, ...providers: Array<Provider<T, O>>) {
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

        throw new NotFoundError('Resource not found.', url);
    }
}
