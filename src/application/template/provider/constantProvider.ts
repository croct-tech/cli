import {ResourceProvider, ProviderOptions} from '@/application/provider/resourceProvider';

export class ConstantProvider<T> implements ResourceProvider<T> {
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
