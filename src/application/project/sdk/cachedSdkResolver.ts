import {Sdk, SdkResolver} from '@/application/project/sdk/sdk';

export class CachedSdkResolver<T extends Sdk|null = Sdk> implements SdkResolver<T> {
    private sdk?: Promise<T>;

    private resolver: SdkResolver<T>;

    public constructor(resolver: SdkResolver<T>) {
        this.resolver = resolver;
    }

    public resolve(hint?: string): Promise<T> {
        if (this.sdk === undefined) {
            this.sdk = this.resolver.resolve(hint);
        }

        return this.sdk;
    }
}
