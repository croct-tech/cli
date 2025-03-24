import {ProviderError} from '@/application/provider/provider';
import {EntryProvider} from '@/application/provider/entryProvider';
import {ErrorReason} from '@/application/error';

export class MapProvider<K, V> implements EntryProvider<K, V> {
    private readonly map: ReadonlyMap<K, V>;

    public constructor(map: ReadonlyMap<K, V>) {
        this.map = map;
    }

    public supports(key: K): boolean {
        return this.map.has(key);
    }

    public get(key: K): Promise<V> {
        const value = this.map.get(key);

        if (value === undefined) {
            throw new ProviderError(`No value found for key \`${key}\`.`, {
                reason: ErrorReason.NOT_FOUND,
            });
        }

        return Promise.resolve(value);
    }
}
