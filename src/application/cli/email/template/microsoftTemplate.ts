import {EmailInfo, EmailLinkTemplate} from '@/application/cli/email/email';

export class MicrosoftTemplate implements EmailLinkTemplate {
    public generate(info: EmailInfo): URL {
        const url = new URL('https://outlook.live.com/mail');

        if (info.recipient !== undefined) {
            url.searchParams.append('login_hint', info.recipient);
        }

        return url;
    }
}
