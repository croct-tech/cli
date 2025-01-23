import {Help, HelpfulError} from '@/application/error';

export interface Provider<A extends any[], R> {
    get(...args: A): Promise<R>|R;
}

export class ProviderError extends HelpfulError {
    public constructor(message: string, help: Help = {}) {
        super(message, help);

        Object.setPrototypeOf(this, ProviderError.prototype);
    }
}
