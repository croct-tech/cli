import {ResourceProvider, ProviderOptions} from '@/application/provider/resourceProvider';

export type Adapter<I, R> = (value: I, url: URL) => R|Promise<R>;

export type Configuration<I, R, O extends ProviderOptions> = {
    provider: ResourceProvider<I, O>,
    adapter: Adapter<I, R>,
};

export class AdaptedProvider<I, R, O extends ProviderOptions> implements ResourceProvider<R, O> {
    private readonly provider: ResourceProvider<I, O>;

    private readonly adapter: Adapter<I, R>;

    public constructor({adapter, provider}: Configuration<I, R, O>) {
        this.adapter = adapter;
        this.provider = provider;
    }

    public supports(url: URL): boolean {
        return this.provider.supports(url);
    }

    public async get(url: URL, options?: O): Promise<R> {
        return this.adapter(await this.provider.get(url, options), url);
    }
}
