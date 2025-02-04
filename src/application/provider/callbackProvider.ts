import {Provider} from '@/application/provider/provider';

export type Callback<T, A extends any[]> = (...args: A) => T|Promise<T>;

export class CallbackProvider<T, A extends any[]> implements Provider<T, A> {
    private readonly callback: Callback<T, A>;

    public constructor(callback: Callback<T, A>) {
        this.callback = callback;
    }

    public get(...args: A): T|Promise<T> {
        return this.callback(...args);
    }
}
