import {EmailInfo, EmailLinkTemplate} from '@/application/cli/email/email';

export class GoogleTemplate implements EmailLinkTemplate {
    public generate(info: EmailInfo): URL {
        return new URL(`https://mail.google.com/mail${GoogleTemplate.formatFilters(info)}`);
    }

    private static formatFilters(info: EmailInfo): string {
        const criteria: string[] = [`to:${info.recipient}`];

        let path = `/u/${info.recipient}`;

        if (info.sender !== undefined) {
            criteria.push(`from:${info.sender}`);
        }

        if (info.subject !== undefined) {
            criteria.push(`subject:${info.subject}`);
        }

        if (info.timestamp !== undefined) {
            criteria.push(`after:${new Date(info.timestamp * 1000).toISOString().split('T')[0]}`);
        }

        criteria.push('in:anywhere');

        path += `/#search/${criteria.map(filter => encodeURIComponent(filter)).join('+')}`;

        return path;
    }
}
