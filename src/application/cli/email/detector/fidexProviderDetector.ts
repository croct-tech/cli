import {EmailProviderDetector} from '@/application/cli/email/email';

export class FixedProviderDetector implements EmailProviderDetector {
    private readonly provider: string|null;

    public constructor(provider: string|null) {
        this.provider = provider;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- For compatibility
    public detect(_: string): Promise<string|null> {
        return Promise.resolve(this.provider);
    }
}
