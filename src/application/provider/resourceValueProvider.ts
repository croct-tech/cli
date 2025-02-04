import {Resource} from '@/application/provider/resourceProvider';
import {Provider} from '@/application/provider/provider';

export class ResourceValueProvider<T> implements Provider<T> {
    private readonly provider: Provider<Resource<T>>;

    public constructor(provider: Provider<Resource<T>>) {
        this.provider = provider;
    }

    public async get(): Promise<T> {
        const resource = await this.provider.get();

        return resource.value;
    }
}
