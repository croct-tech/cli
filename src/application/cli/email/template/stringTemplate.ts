import {EmailInfo, EmailLinkTemplate} from '@/application/cli/email/email';

export class StringTemplate implements EmailLinkTemplate {
    private readonly template: string;

    public constructor(template: string) {
        this.template = template;
    }

    public generate(info: EmailInfo): URL {
        return new URL(
            this.template
                .replace('%recipient%', info.recipient)
                .replace('%sender%', info.sender ?? '')
                .replace('%subject%', info.subject ?? '')
                .replace('%date%', info.timestamp !== undefined ? new Date(info.timestamp * 1000).toISOString() : '')
                .replace('%instant%', info.timestamp !== undefined ? new Date(info.timestamp * 1000).toISOString() : '')
                .replace('%timestamp%', info.timestamp !== undefined ? info.timestamp.toFixed(0) : ''),
        );
    }
}
