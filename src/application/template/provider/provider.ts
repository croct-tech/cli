import {ErrorReason, Help, HelpfulError} from '@/application/error';

export class ProviderError extends HelpfulError {
    public constructor(message: string, url: URL, help: Help = {}) {
        super(message, {
            ...help,
            details: [
                `URL: ${url}`,
                ...(help.details ?? []),
            ],
        });

        Object.setPrototypeOf(this, ProviderError.prototype);
    }
}

export class NotFoundError extends ProviderError {
    public constructor(message: string, url: URL, help: Help = {}) {
        super(message, url, {
            ...help,
            reason: help.reason ?? ErrorReason.INVALID_INPUT,
        });

        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

export type ProviderOptions = Record<string, any>;

export interface Provider<T, O extends ProviderOptions = ProviderOptions> {
    supports(url: URL): boolean;

    get(url: URL, options?: O): Promise<T>;
}
