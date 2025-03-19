import {ReactExampleGenerator} from './reactExampleGenerator';
import {SlotDefinition} from './slotExampleGenerator';
import {CodeWriter} from '@/application/project/code/generation/codeWritter';
import {CodeLanguage} from '@/application/project/code/generation/example';

export class PlugReactExampleGenerator extends ReactExampleGenerator {
    protected writeSlotHeader(writer: CodeWriter): void {
        switch (this.options.language) {
            case CodeLanguage.JAVASCRIPT_XML:
                writer.write('import {useContent} from \'@croct/plug-react\';');

                break;

            case CodeLanguage.TYPESCRIPT_XML:
                writer.write("import type {ReactElement} from 'react';");
                writer.write('import {useContent} from \'@croct/plug-react\';');

                break;
        }

        writer.newLine();
    }

    protected writeSlotFetch(writer: CodeWriter, definition: SlotDefinition): void {
        const variable = this.options.contentVariable;

        writer.write(`const ${variable} = useContent('${definition.id}@${definition.version}');`)
            .newLine();
    }

    protected isSlotFetchAsync(): boolean {
        return false;
    }

    protected isSlotFetchBlocking(): boolean {
        return false;
    }

    protected hasSuspenseBoundary(): boolean {
        return false;
    }
}
