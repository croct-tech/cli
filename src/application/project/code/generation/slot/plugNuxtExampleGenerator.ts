import {VueExampleGenerator} from './vueExampleGenerator';
import type {SlotDefinition} from './slotExampleGenerator';
import type {CodeWriter} from '@/application/project/code/generation/codeWritter';

export class PlugNuxtExampleGenerator extends VueExampleGenerator {
    protected writeSlotScript(writer: CodeWriter, definition: SlotDefinition): void {
        this.writeScriptOpening(writer);

        writer.write(`const {data} = await useContent('${definition.id}@${definition.version}');`);

        this.writeScriptClosing(writer);
    }

    protected writePageScript(): void {
        // Nuxt auto-imports components from `components/`, so the page needs no script section.
    }
}
