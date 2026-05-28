import type {
    AttributeDefinition,
    ContentDefinition,
    RootDefinition,
} from '@croct/content-model/definition/definition';
import type {SlotDefinition, SlotExampleGenerator} from './slotExampleGenerator';
import type {CodeExample, ExampleFile} from '@/application/project/code/generation/example';
import {CodeLanguage} from '@/application/project/code/generation/example';
import {CodeWriter} from '@/application/project/code/generation/codeWritter';
import {formatLabel, formatSlug, sortAttributes} from '@/application/project/code/generation/utils';
import {formatName} from '@/application/project/utils/formatName';

export type Configuration = {
    typescript: boolean,
    indentationSize?: number,
    contentVariable: string,
    slotImportPath: string,
    slotFilePath: string,
    slotComponentName: string,
    pageFilePath: string,
};

export type SlotFile = {
    name: string,
    path: string,
    importPath: string,
    definition: SlotDefinition,
};

type Attribute = AttributeDefinition & {
    name: string,
};

export abstract class VueExampleGenerator implements SlotExampleGenerator {
    protected readonly options: Configuration;

    public constructor(options: Configuration) {
        this.options = options;
    }

    public generate(definition: SlotDefinition): CodeExample {
        const slotPath = VueExampleGenerator.replaceVariables(this.options.slotFilePath, definition.id);
        const slotName = VueExampleGenerator.replaceVariables(this.options.slotComponentName, definition.id);

        return {
            files: [
                this.generatePageFile(definition, {
                    name: slotName,
                    path: slotPath,
                    importPath: VueExampleGenerator.replaceVariables(this.options.slotImportPath, definition.id),
                    definition: definition,
                }),
                this.generateSlotFile(definition, slotPath),
            ],
        };
    }

    protected abstract writeSlotScript(writer: CodeWriter, definition: SlotDefinition): void;

    protected abstract writePageScript(writer: CodeWriter, slot: SlotFile): void;

    protected getLoadingFlag(): string | null {
        return null;
    }

    private generateSlotFile(definition: SlotDefinition, path: string): ExampleFile {
        const writer = this.createWriter();
        const variable = this.options.contentVariable;
        const loadingFlag = this.getLoadingFlag();

        this.writeSlotScript(writer, definition);

        writer.newLine();
        writer.write('<template>')
            .indent();

        if (loadingFlag !== null) {
            writer.write(`<p v-if="${loadingFlag}">Loading...</p>`)
                .write('<template v-else>')
                .indent();

            this.writeRoot(writer, definition.definition, variable);

            writer.outdent()
                .write('</template>');
        } else {
            this.writeRoot(writer, definition.definition, variable);
        }

        writer.outdent()
            .write('</template>', false);

        return {
            path: path,
            language: CodeLanguage.VUE,
            code: writer.toString(),
        };
    }

    private generatePageFile(definition: SlotDefinition, slot: SlotFile): ExampleFile {
        const writer = this.createWriter();
        const pagePath = VueExampleGenerator.replaceVariables(this.options.pageFilePath, definition.id);

        this.writePageScript(writer, slot);

        if (writer.toString() !== '') {
            writer.newLine();
        }

        writer.write('<template>')
            .indent()
            .write(`<${slot.name} />`)
            .outdent()
            .write('</template>', false);

        return {
            path: pagePath,
            language: CodeLanguage.VUE,
            code: writer.toString(),
        };
    }

    protected writeScriptOpening(writer: CodeWriter): void {
        writer.write(this.options.typescript ? '<script setup lang="ts">' : '<script setup>');
    }

    protected writeScriptClosing(writer: CodeWriter): void {
        writer.write('</script>');
    }

    private writeRoot(writer: CodeWriter, definition: RootDefinition, path: string): void {
        if (definition.type === 'union') {
            this.writeUnion(writer, definition, path);

            return;
        }

        writer.write(`<ul v-if="${path}">`)
            .indent();

        this.writeStructureAttributes(writer, definition, path);

        writer.outdent()
            .write('</ul>');
    }

    private writeFragment(writer: CodeWriter, definition: ContentDefinition, path: string): void {
        switch (definition.type) {
            case 'text':
            case 'number':
                writer.append(`{{ ${path} }}`);

                break;

            case 'boolean':
                writer.append(VueExampleGenerator.formatBooleanInterpolation(definition, path));

                break;

            case 'list':
                this.writeList(writer, definition, path);

                break;

            case 'structure':
                writer.write('<ul>')
                    .indent();

                this.writeStructureAttributes(writer, definition, path);

                writer.outdent()
                    .write('</ul>');

                break;

            case 'union':
                this.writeUnion(writer, definition, path);

                break;
        }
    }

    private writeList(writer: CodeWriter, definition: ContentDefinition<'list'>, path: string): void {
        const variable = definition.itemLabel !== undefined
            ? formatName(definition.itemLabel)
            : 'item';

        writer.write('<ol>')
            .indent()
            .write(`<li v-for="(${variable}, index) in ${path}" :key="index">`)
            .indent();

        const inline = VueExampleGenerator.isInline(definition.items);

        if (inline) {
            writer.appendIndentation();
        }

        this.writeFragment(writer, definition.items, variable);

        if (inline) {
            writer.newLine();
        }

        writer.outdent()
            .write('</li>')
            .outdent()
            .write('</ol>');
    }

    private writeStructureAttributes(
        writer: CodeWriter,
        definition: ContentDefinition<'structure'>,
        path: string,
    ): void {
        for (const [name, attribute] of sortAttributes(definition.attributes)) {
            if (attribute.private === true) {
                continue;
            }

            this.writeAttribute(writer, {name: name, ...attribute}, path);
        }
    }

    private writeAttribute(writer: CodeWriter, attribute: Attribute, parentPath: string): void {
        const path = `${parentPath}.${attribute.name}`;
        const definition = attribute.type;
        const label = VueExampleGenerator.escapeEntities(attribute.label ?? formatLabel(attribute.name));
        const guard = attribute.optional === true ? ` v-if="${path}"` : '';

        switch (definition.type) {
            case 'boolean':
            case 'text':
            case 'number': {
                writer.write(`<li${guard}>`, false)
                    .append(`<strong>${label}:</strong> `);

                this.writeFragment(writer, definition, path);

                writer.append('</li>')
                    .newLine();

                break;
            }

            default:
                writer.write(`<li${guard}>`)
                    .indent()
                    .write(`<strong>${label}</strong>`);

                this.writeFragment(writer, definition, path);

                writer.outdent()
                    .write('</li>');

                break;
        }
    }

    private writeUnion(writer: CodeWriter, definition: ContentDefinition<'union'>, path: string): void {
        for (const [id, variant] of Object.entries(definition.types)) {
            writer.write(`<template v-if="${path}?._type === '${id}'">`)
                .indent();

            this.writeFragment(writer, variant, path);

            writer.outdent()
                .write('</template>');
        }
    }

    private static formatBooleanInterpolation(
        definition: ContentDefinition<'boolean'>,
        path: string,
    ): string {
        const trueLabel = definition.label?.true ?? 'Yes';
        const falseLabel = definition.label?.false ?? 'No';

        return `{{ ${path} ? '${trueLabel.replace(/'/g, "\\'")}' : '${falseLabel.replace(/'/g, "\\'")}' }}`;
    }

    private static isInline(definition: ContentDefinition): boolean {
        return ['number', 'text', 'boolean'].includes(definition.type);
    }

    private static escapeEntities(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private createWriter(): CodeWriter {
        return new CodeWriter(this.options.indentationSize);
    }

    private static replaceVariables(path: string, id: string): string {
        return path.replace(/%name%/g, CodeWriter.formatName(id, true))
            .replace(/%slug%/g, formatSlug(id));
    }
}
