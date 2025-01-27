import {ErrorReason, Help} from '@/application/error';
import {Provider, ProviderError} from '@/application/provider/provider';

export type ResourceHelp = Help & {
    url: URL,
};

export class ResourceProviderError extends ProviderError {
    public readonly url: URL;

    public constructor(message: string, {url, ...help}: ResourceHelp) {
        super(message, help);

        Object.setPrototypeOf(this, ResourceProviderError.prototype);

        this.url = url;
    }
}

export class ResourceNotFoundError extends ResourceProviderError {
    public constructor(message: string, help: ResourceHelp) {
        super(message, {
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
