export namespace System {
    export function getLocale(): string {
        return Intl.DateTimeFormat()
            .resolvedOptions()
            .locale
            .toLowerCase();
    }

    export function getTimeZone(): string {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
}
