import {VueExampleGenerator} from './vueExampleGenerator';
import type {SlotFile} from './vueExampleGenerator';
import type {SlotDefinition} from './slotExampleGenerator';
import type {CodeWriter} from '@/application/project/code/generation/codeWritter';

export class PlugVueExampleGenerator extends VueExampleGenerator {
    protected writeSlotScript(writer: CodeWriter, definition: SlotDefinition): void {
        const variable = this.options.contentVariable;
        const dataBinding = variable === 'data' ? variable : `data: ${variable}`;

        this.writeScriptOpening(writer);

        writer.write("import {useContent} from '@croct/plug-vue';")
            .newLine()
            .write(`const {${dataBinding}, isLoading} = useContent('${definition.id}@${definition.version}');`);

        this.writeScriptClosing(writer);
    }

    protected writePageScript(writer: CodeWriter, slot: SlotFile): void {
        this.writeScriptOpening(writer);

        writer.write(`import ${slot.name} from '${slot.importPath}';`);

        this.writeScriptClosing(writer);
    }

    protected override getLoadingFlag(): string {
        return 'isLoading';
    }
}
