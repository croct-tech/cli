import {Instant, LocalDateTime, TimeZone} from '@croct/time';
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
            const timeZone = TimeZone.of(Intl.DateTimeFormat().resolvedOptions().timeZone);
            const instant = Instant.ofEpochSecond(info.timestamp);
            const today = LocalDateTime.ofInstant(instant, timeZone).getLocalDate();

            criteria.push(`after:${today}`);
        }

        criteria.push('in:anywhere');

        path += `/#search/${criteria.map(filter => encodeURIComponent(filter)).join('+')}`;

        return path;
    }
}
