export class BufferedIterator<T> implements AsyncIterable<T> {
    private open = true;

    private readonly queue: T[] = [];

    private resolve: (() => void) | undefined;

    public async* [Symbol.asyncIterator](): AsyncIterator<T> {
        this.open = true;

        while (this.open) {
            if (this.queue.length > 0) {
                yield this.queue.shift()!;

                continue;
            }

            await new Promise<void>(resolve => {
                this.resolve = resolve;
            });
        }
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
