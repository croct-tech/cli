import {EmailProviderDetector} from '@/application/cli/email/email';

type LookupResponse = {
    Answer?: Array<{
        name: string,
        type: number,
        TTL: number,
        data: string,
    }>,
};

export class DnsProviderDetector implements EmailProviderDetector {
    public static readonly DEFAULT_DOMAINS: Readonly<Record<string, string[]>> = {
        google: [
            'google.com',
        ],
        microsoft: [
            'outlook.com',
        ],
    };

    private readonly domains: Record<string, string[]>;

    public constructor(domains = DnsProviderDetector.DEFAULT_DOMAINS) {
        this.domains = domains;
    }

    public async detect(email: string): Promise<string|null> {
        const domain = email.toLowerCase().split('@')[1];
        const lookup = await this.lookup(domain);

        for (const [provider, domains] of Object.entries(this.domains)) {
            for (const providerDomain of domains) {
                for (const mx of lookup) {
                    if (mx.endsWith(`.${providerDomain}.`)) {
                        return provider;
                    }
                }
            }
        }

        return null;
    }

    private async lookup(domain: string): Promise<string[]> {
        const endpoint = new URL('https://dns.google.com/resolve');

        endpoint.searchParams.set('type', 'MX');
        endpoint.searchParams.set('name', domain);

        let lookup: LookupResponse;

        try {
            lookup = await fetch(endpoint).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to lookup domain');
                }

                return response.json() as Promise<LookupResponse>;
            });
        } catch {
            return [];
        }

        if (lookup.Answer === undefined) {
            return [];
        }

        return lookup.Answer.map(answer => answer.data);
    }
}
