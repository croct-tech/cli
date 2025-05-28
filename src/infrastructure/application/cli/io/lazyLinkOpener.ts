import {LinkOpener} from '@/infrastructure/application/cli/io/consoleOutput';

export type LinkOpenerFactory = () => LinkOpener;

export class LazyLinkOpener implements LinkOpener {
    private readonly factory: LinkOpenerFactory;

    private instance?: LinkOpener;

    public constructor(factory: LinkOpenerFactory) {
        this.factory = factory;
    }

    public open(target: string): Promise<void> {
        if (this.instance === undefined) {
            this.instance = this.factory();
        }

        return this.instance.open(target);
    }
}
