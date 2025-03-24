import {EmailProviderDetector} from '@/application/cli/email/email';

export class DomainProviderDetector implements EmailProviderDetector {
    public static readonly DEFAULT_DOMAINS: Readonly<Record<string, Array<string|RegExp>>> = {
        google: [
            'gmail.com',
            'googlemail.com',
            'google.com',
        ],
        yahoo: [
            /yahoo\.com(?:\.\w+)?/,
            'yahoo.co.uk',
            'yahoo.fr',
            'yahoo.it',
            'ymail.com',
            'rocketmail.com',
        ],
        microsoft: [
            'outlook.com',
            'live.com',
            'hotmail.com',
            'msn.com',
            'passport.com',
            'passport.net',
        ],
        proton: [
            'proton.me',
            'protonmail.com',
        ],
        icloud: [
            'icloud.com',
        ],
    };

    private readonly domains: Record<string, Array<string|RegExp>>;

    public constructor(domains = DomainProviderDetector.DEFAULT_DOMAINS) {
        this.domains = domains;
    }

    public detect(email: string): Promise<string|null> {
        const domain = email.toLowerCase().split('@')[1];

        for (const [provider, domains] of Object.entries(this.domains)) {
            const matches = domains.some(
                candidate => (typeof candidate === 'string' ? candidate === domain : candidate.test(domain)),
            );

            if (matches) {
                return Promise.resolve(provider);
            }
        }

        return Promise.resolve(null);
    }
}
