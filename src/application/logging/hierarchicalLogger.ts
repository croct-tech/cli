import {Log, Logger} from '@croct/logging';

export type Callback<R> = () => Promise<R>;

export interface HierarchicalLogger<L extends Log = Log> extends Logger<L> {
    nest<R>(log: L, callback: Callback<R>): Promise<R>;
}
