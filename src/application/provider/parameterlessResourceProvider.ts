import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';
import {Resource, ResourceProvider} from '@/application/provider/resourceProvider';

export type Configuration<R> = {
    url: URL,
    provider: ResourceProvider<R>,
};

export class ParameterlessResourceProvider<R> implements ParameterlessProvider<Resource<R>> {
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
