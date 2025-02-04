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
            reason: help.reason ?? ErrorReason.NOT_FOUND,
        });

        Object.setPrototypeOf(this, ResourceNotFoundError.prototype);
    }
}

export type Resource<T> = {
    url: URL,
    value: T,
};

export interface ResourceProvider<T> extends Provider<Resource<T>, [URL]> {
    supports(url: URL): boolean;

    get(url: URL): Promise<Resource<T>>;
}
