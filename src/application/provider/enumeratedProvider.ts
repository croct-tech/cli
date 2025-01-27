import {Provider, ProviderError} from '@/application/provider/provider';

export type Discriminator<K extends string> = () => Promise<K>;

type Mapping<K extends string, V> = Record<K, V|(() => Promise<V>|V)>;

export type Configuration<K extends string, V> = {
    discriminator: Discriminator<K>,
    mapping: Mapping<K, V>,
};

export class EnumeratedProvider<K extends string, V> implements Provider<[], V> {
    private readonly discriminator: Discriminator<K>;

    private readonly mapping: Mapping<K, V>;

    public constructor(config: Configuration<K, V>) {
        this.discriminator = config.discriminator;
        this.mapping = config.mapping;
    }

    public async get(): Promise<V> {
        const key = await this.discriminator();
        const value = this.mapping[key];

        if (value === undefined) {
            throw new ProviderError(`No value found for discriminator "${key}".`);
        }

        return value instanceof Function ? value() : value;
    }
}
