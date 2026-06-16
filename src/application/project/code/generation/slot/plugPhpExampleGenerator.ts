import type {Configuration as PhpExampleConfiguration} from './phpExampleGenerator';
import {PhpExampleGenerator} from './phpExampleGenerator';
import type {SlotDefinition} from './slotExampleGenerator';
import type {CodeWriter} from '@/application/project/code/generation/codeWritter';

export type Configuration = PhpExampleConfiguration & {
    autoloadPath: string,
};

/**
 * Generates a framework-agnostic PHP example page for a slot.
 *
 * Bootstraps the SDK from the environment, fetches the slot content, and emits
 * the session cookies before rendering the page.
 */
export class PlugPhpExampleGenerator extends PhpExampleGenerator {
    private readonly autoloadPath: string;

    public constructor(configuration: Configuration) {
        super(configuration);

        this.autoloadPath = configuration.autoloadPath;
    }

    protected writeScript(writer: CodeWriter, definition: SlotDefinition): void {
        const slotId = PlugPhpExampleGenerator.escapeString(definition.id);
        const rootPath = this.autoloadPath.replace(/\/?vendor\/autoload\.php$/, '') || '.';

        writer.write('<?php')
            .newLine()
            .write('declare(strict_types=1);')
            .newLine()
            .write('use Croct\\Plug\\Croct;')
            .newLine()
            .write(`require __DIR__ . '/${this.autoloadPath}';`)
            .newLine()
            .write(`$croct = Croct::fromDotenv(__DIR__ . '/${rootPath}');`)
            .newLine()
            .write(`$${this.options.contentVariable} = $croct->fetchContent('${slotId}')->getContent();`)
            .newLine()
            .write('Croct::emitCookies();')
            .newLine()
            .write('?>', false);
    }
}
