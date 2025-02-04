import {Provider} from '@/application/provider/provider';

export class SequentialProvider<T, A extends any[]> implements Provider<T|null, A> {
    private readonly providers: Array<Provider<T, A>>;

    public constructor(...providers: Array<Provider<T, A>>) {
        this.providers = providers;
    }

    public async get(...args: A): Promise<T|null> {
        for (const provider of this.providers) {
            const value = await provider.get(...args) ?? null;

            if (value !== null) {
                return value;
            }
        }

        return null;
    }
}
