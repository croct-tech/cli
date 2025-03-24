import {EmailProviderDetector} from '@/application/cli/email/email';

export class FallbackProviderDetector implements EmailProviderDetector {
    private readonly detectors: EmailProviderDetector[];

    public constructor(...detectors: EmailProviderDetector[]) {
        this.detectors = detectors;
    }

    public async detect(email: string): Promise<string|null> {
        for (const detector of this.detectors) {
            const provider = await detector.detect(email);

            if (provider !== null) {
                return provider;
            }
        }

        return null;
    }
}
