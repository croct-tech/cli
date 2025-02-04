import {Provider} from '@/application/provider/provider';

export class MemoizedProvider<T, A extends any[]> implements Provider<T, A> {
    private readonly valueProvider: Provider<T, A>;

    private readonly keyProvider?: Provider<any, A>;

    private value?: Promise<T>;

    private key?: any;

    public constructor(valueProvider: Provider<T, A>, keyProvider?: Provider<string, A>) {
        this.valueProvider = valueProvider;
        this.keyProvider = keyProvider;
    }

    public async get(...args: A): Promise<T> {
        if (this.keyProvider !== undefined) {
            const previousKey = this.key;

            this.key = await this.keyProvider.get(...args);

            if (previousKey === this.key && this.value !== undefined) {
                return this.value;
            }
        } else if (this.value !== undefined) {
            return this.value;
        }

        this.value = Promise.resolve(this.valueProvider.get(...args));

        return this.value;
    }
}
