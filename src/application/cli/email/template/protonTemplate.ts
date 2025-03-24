import {EmailInfo, EmailLinkTemplate} from '@/application/cli/email/email';

export class ProtonTemplate implements EmailLinkTemplate {
    public generate(info: EmailInfo): URL {
        return new URL(`https://mail.proton.me/u/0/all-mail${ProtonTemplate.formatFilters(info)}`);
    }

    private static formatFilters(info: EmailInfo): string {
        const params = new URLSearchParams();

        params.set('to', info.recipient);

        if (info.sender !== undefined) {
            params.set('from', info.sender);
        }

        if (info.timestamp !== undefined) {
            params.set('begin', info.timestamp.toFixed(0));
        }

        if (info.subject !== undefined) {
            params.set('keyword', info.subject);
        }

        return `#${params.toString()}`;
    }
}
