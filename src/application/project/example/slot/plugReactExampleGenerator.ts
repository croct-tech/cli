import {ReactExampleGenerator} from './reactExampleGenerator';
import {SlotDefinition} from './slotExampleGenerator';
import {CodeWriter} from '@/application/project/example/codeWritter';
import {CodeLanguage} from '@/application/project/example/example';
import {formatName} from '@/application/project/utils/formatName';

export class PlugReactExampleGenerator extends ReactExampleGenerator {
    protected writeSlotHeader(writer: CodeWriter, definition: SlotDefinition): void {
        switch (this.options.language) {
            case CodeLanguage.JAVASCRIPT_XML:
                writer.write('import {useContent} from \'@croct/plug-react\';');

                break;

            case CodeLanguage.TYPESCRIPT_XML:
                writer.write("import type {ReactElement} from 'react';");
                writer.write('import {useContent} from \'@croct/plug-react\';');

                break;
        }

        const {variables} = this.options.code;
        const importName = formatName(`${definition.id} V${definition.version}`);

        writer.write(`import {${importName} as ${variables.fallbackContent}} from '@croct/content/slot';`);

        writer.newLine();
    }

    protected writeSlotFetch(writer: CodeWriter, definition: SlotDefinition): void {
        const {variables} = this.options.code;

        writer.write(`const ${variables.content} = useContent('${definition.id}@${definition.version}', {`)
            .indent()
            .write(`fallback: ${variables.fallbackContent},`)
            .outdent()
            .write('});')
            .newLine();
    }

    protected isSlotFetchAsync(): boolean {
        return false;
    }

    protected isSlotFetchBlocking(): boolean {
        return false;
    }

    protected hasSuspenseBoundary(): boolean {
        return true;
    }
}
