import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';
import {Resource} from '@/application/provider/resourceProvider';

export class ResourceValueProvider<T> implements ParameterlessProvider<T> {
    private readonly provider: ParameterlessProvider<Resource<T>>;

    public constructor(provider: ParameterlessProvider<Resource<T>>) {
        this.provider = provider;
    }

    public async get(): Promise<T> {
        const resource = await this.provider.get();

        return resource.value;
    }
}
