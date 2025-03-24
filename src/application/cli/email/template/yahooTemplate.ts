import {EmailInfo, EmailLinkTemplate} from '@/application/cli/email/email';

export class YahooTemplate implements EmailLinkTemplate {
    public generate(info: EmailInfo): URL {
        return new URL(`https://mail.yahoo.com/d/search${YahooTemplate.formatFilters(info)}`);
    }

    private static formatFilters(info: EmailInfo): string {
        const filters: string[] = [`to:${info.recipient}`];

        if (info.sender !== undefined) {
            filters.push(`from:${info.sender}`);
        }

        if (info.subject !== undefined) {
            filters.push(`subject:${info.subject}`);
        }

        if (info.timestamp !== undefined) {
            filters.push(`after:"${new Date(info.timestamp * 1000).toISOString().split('T')[0]}"`);
        }

        if (filters.length === 0) {
            return '';
        }

        return `/keyword=${filters.join(' ')}`;
    }
}
