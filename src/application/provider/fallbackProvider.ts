import {Provider} from '@/application/provider/provider';

export class FallbackProvider<T, A extends any[]> implements Provider<T, A> {
    private readonly provider: Provider<T, A>;

    private readonly fallback: Provider<NonNullable<T>, A>;

    public constructor(provider: Provider<T, A>, fallback: Provider<NonNullable<T>, A>) {
        this.provider = provider;
        this.fallback = fallback;
    }

    public async get(...args: A): Promise<NonNullable<T>> {
        const value = await this.provider.get(...args) ?? null;

        if (value !== null) {
            return value;
        }

        return this.fallback.get(...args);
    }
}
