import {Resource, ResourceProvider} from '@/application/provider/resource/resourceProvider';
import {Provider} from '@/application/provider/provider';

export type Configuration<R> = {
    url: URL,
    provider: ResourceProvider<R>,
};

export class SpecificResourceProvider<R> implements Provider<Resource<R>> {
    private readonly url: URL;

    private readonly provider: ResourceProvider<R>;

    public constructor({url, provider}: Configuration<R>) {
        this.url = url;
        this.provider = provider;
    }

    public get(): Promise<Resource<R>> {
        return this.provider.get(this.url);
    }
}
