import {Provider, ProviderOptions} from '@/application/template/provider/provider';

export class ConstantProvider<T> implements Provider<T> {
    private readonly data: T;

    public constructor(data: T) {
        this.data = data;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Keep the same signature as the interface
    public supports(_: URL): boolean {
        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Keep the same signature as the interface
    public get(_url: URL, _options: ProviderOptions): Promise<T> {
        return Promise.resolve(this.data);
    }
}
