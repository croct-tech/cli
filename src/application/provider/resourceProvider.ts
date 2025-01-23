import {ErrorReason, Help} from '@/application/error';
import {Provider, ProviderError} from '@/application/provider/provider';

export class ResourceProviderError extends ProviderError {
    public constructor(message: string, url: URL, help: Help = {}) {
        super(message, {
            ...help,
            details: [
                `Resource URL: ${url}`,
                ...(help.details ?? []),
            ],
        });

        Object.setPrototypeOf(this, ResourceProviderError.prototype);
    }
}

export class ResourceNotFoundError extends ResourceProviderError {
    public constructor(message: string, url: URL, help: Help = {}) {
        super(message, url, {
            ...help,
            reason: help.reason ?? ErrorReason.INVALID_INPUT,
        });

        Object.setPrototypeOf(this, ResourceNotFoundError.prototype);
    }
}

export type ProviderOptions = Record<string, any>;

export interface ResourceProvider<T, O extends ProviderOptions = ProviderOptions> extends Provider<[URL, O], T> {
    supports(url: URL): boolean;

    get(url: URL, options?: O): Promise<T>;
}
