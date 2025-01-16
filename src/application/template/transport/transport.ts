export class TransportError extends Error {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, TransportError.prototype);
    }
}

export class NotFoundError extends TransportError {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

export type TransportOptions = Record<string, any>;

export interface Transport<T, O extends TransportOptions = TransportOptions> {
    supports(url: URL): boolean;

    fetch(url: URL, options?: O): Promise<T>;
}
