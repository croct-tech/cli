import {LinkOpener} from '@/infrastructure/application/cli/io/consoleOutput';
import {Output} from '@/application/cli/io/output';

export class ConsoleLinkOpener implements LinkOpener {
    private readonly output: Output;

    public constructor(output: Output) {
        this.output = output;
    }

    public open(target: string): Promise<void> {
        // Escape special characters that could break the Markdown link syntax.
        const url = target.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');

        this.output.log(`[${url}](${url})`);

        return Promise.resolve();
    }
}
