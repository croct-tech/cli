import {Provider} from '@/application/provider/provider';

export interface EntryProvider<K, V> extends Provider<V, [K]> {
}
