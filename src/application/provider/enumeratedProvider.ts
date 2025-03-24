import {Provider, ProviderError} from '@/application/provider/provider';
import {ErrorReason} from '@/application/error';

export type Discriminator<K extends PropertyKey> = () => Promise<K>;

type Mapping<K extends PropertyKey, V> = Record<K, (() => Promise<V>|V)|Provider<V>>;

export type Configuration<K extends PropertyKey, V> = {
    discriminator: Discriminator<K>,
    mapping: Mapping<K, V>,
};

export class EnumeratedProvider<K extends PropertyKey, V> implements Provider<V> {
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
            throw new ProviderError(`No value found for discriminator "${String(key)}".`, {
                reason: ErrorReason.NOT_SUPPORTED,
            });
        }

        if (value instanceof Function) {
            return value();
        }

        return value.get();
    }
}
