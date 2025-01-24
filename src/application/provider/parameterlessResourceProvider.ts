import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';
import {ResourceProvider} from '@/application/provider/resourceProvider';

export type Configuration<R> = {
    url: URL,
    provider: ResourceProvider<R>,
};

export class ParameterlessResourceProvider<R> implements ParameterlessProvider<R> {
    private readonly url: URL;

    private readonly provider: ResourceProvider<R>;

    public constructor({url, provider}: Configuration<R>) {
        this.url = url;
        this.provider = provider;
    }

    public get(): Promise<R> {
        return this.provider.get(this.url);
    }
}
