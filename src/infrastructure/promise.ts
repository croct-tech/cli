export type Executor<T> = () => Promise<T>|T;

export class LazyPromise<T> extends Promise<T> {
    readonly #executor: Executor<T>;

    readonly #transient: boolean;

    #promise: Promise<T>;

    public constructor(executor: Executor<T>, transient = false) {
        super(() => {});

        this.#executor = executor;
        this.#transient = transient;
    }

    public static from<T>(executor: Executor<T>): Promise<T> {
        return new LazyPromise(executor);
    }

    public static transient<T>(executor: Executor<T>): Promise<T> {
        return new LazyPromise(executor, true);
    }

    private get promise(): Promise<T> {
        if (this.#promise !== undefined) {
            return this.#promise;
        }

        const promise = new Promise<T>(resolve => {
            resolve(this.#executor());
        });

        if (!this.#transient) {
            this.#promise = promise;
        }

        return promise;
    }

    public then<F = T, R = never>(
        onFulfilled?: ((value: T) => F | PromiseLike<F>) | undefined | null,
        onRejected?: ((reason: any) => R | PromiseLike<R>) | undefined | null,
    ): Promise<F | R> {
        return this.promise.then(onFulfilled, onRejected);
    }

    public catch<R = never>(onRejected?: ((reason: any) => R | PromiseLike<R>) | undefined | null): Promise<T | R> {
        return this.promise.catch(onRejected);
    }

    public finally(onFinally?: (() => void) | undefined | null): Promise<T> {
        return this.promise.finally(onFinally);
    }
}
