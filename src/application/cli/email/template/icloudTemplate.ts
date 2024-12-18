import {EmailInfo, EmailLinkTemplate} from '@/application/cli/email/email';

export class ICloudTemplate implements EmailLinkTemplate {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- For compatibility
    public generate(_: EmailInfo): URL {
        return new URL('https://www.icloud.com/mail');
    }
}
