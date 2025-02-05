export class BufferedIterator<T> implements AsyncIterator<T>, AsyncIterable<T> {
    private open = true;

    private readonly queue: T[] = [];

    private resolve: (() => void) | undefined;

    public async* [Symbol.asyncIterator](): AsyncIterator<T> {
        let next = await this.next();

        while (next.done !== true) {
            yield next.value;

            next = await this.next();
        }
    }

    public next(): Promise<IteratorResult<T>> {
        if (this.queue.length > 0) {
            return Promise.resolve({done: false, value: this.queue.shift()!});
        }

        if (!this.open) {
            return Promise.resolve({done: true, value: undefined});
        }

        return new Promise<IteratorResult<T>>(resolve => {
            this.resolve = (): void => {
                this.resolve = undefined;

                if (this.queue.length === 0) {
                    resolve({done: true, value: undefined});
                } else {
                    resolve({done: false, value: this.queue.shift()!});
                }
            };
        });
    }

    public push(data: T): void {
        this.queue.push(data);
        this.resolve?.();
    }

    public close(): void {
        this.open = false;
        this.resolve?.();
    }
}
