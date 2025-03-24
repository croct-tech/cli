import {Provider} from '@/application/provider/provider';

export class ConstantProvider<T> implements Provider<T> {
    private readonly data: T;

    public constructor(data: T) {
        this.data = data;
    }

    public get(): Promise<T> {
        return Promise.resolve(this.data);
    }
}
