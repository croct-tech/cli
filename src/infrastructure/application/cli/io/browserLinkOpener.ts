import open from 'open';
import type {LinkOpener} from '@/infrastructure/application/cli/io/consoleOutput';

export class BrowserLinkOpener implements LinkOpener {
    private readonly fallbackOpener: LinkOpener;

    public constructor(fallbackOpener: LinkOpener) {
        this.fallbackOpener = fallbackOpener;
    }

    public async open(target: string): Promise<void> {
        try {
            await open(target);
        } catch {
            return this.fallbackOpener.open(target);
        }
    }
}
