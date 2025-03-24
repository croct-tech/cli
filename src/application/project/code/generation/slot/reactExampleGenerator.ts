import {AttributeDefinition, ContentDefinition} from '@croct/content-model/definition/definition';
import {SlotDefinition, SlotExampleGenerator} from './slotExampleGenerator';
import {CodeExample, CodeLanguage, ExampleFile} from '@/application/project/code/generation/example';
import {CodeWriter} from '@/application/project/code/generation/codeWritter';
import {formatLabel, formatSlug, sortAttributes} from '@/application/project/code/generation/utils';
import {FileSystem} from '@/application/fs/fileSystem';
import {formatName} from '@/application/project/utils/formatName';

export type Configuration = {
    fileSystem: FileSystem,
    language: CodeLanguage.JAVASCRIPT_XML | CodeLanguage.TYPESCRIPT_XML,
    indentationSize?: number,
    contentVariable: string,
    slotImportPath: string,
    slotFilePath: string,
    slotComponentName: string,
    pageFilePath: string,
    pageComponentName: string,
};

type Attribute = AttributeDefinition & {
    name: string,
};

export type SlotFile = {
    name: string,
    path: string,
    importPath: string,
    definition: SlotDefinition,
};

export abstract class ReactExampleGenerator implements SlotExampleGenerator {
    protected readonly options: Omit<Configuration, 'fileSystem'>;

    protected readonly fileSystem: FileSystem;

    public constructor({fileSystem, ...options}: Configuration) {
        this.options = options;
        this.fileSystem = fileSystem;
    }

    public generate(definition: SlotDefinition): CodeExample {
        const slotPath = ReactExampleGenerator.replaceVariables(this.options.slotFilePath, definition.id);
        const slotName = ReactExampleGenerator.replaceVariables(this.options.slotComponentName, definition.id);

        return {
            files: [
                this.generatePageFile(definition, {
                    name: slotName,
                    path: slotPath,
                    importPath: ReactExampleGenerator.replaceVariables(this.options.slotImportPath, definition.id),
                    definition: definition,
                }),
                this.generateSlotFile(definition, slotPath, slotName),
            ],
        };
    }

    private generatePageFile(definition: SlotDefinition, slotFile: SlotFile): ExampleFile {
        const writer = this.createWriter();
        const pagePath = ReactExampleGenerator.replaceVariables(this.options.pageFilePath, definition.id);
        const pageName = ReactExampleGenerator.replaceVariables(this.options.pageComponentName, definition.id);

        this.writePageSnippet(writer, pageName, slotFile);

        return {
            path: pagePath,
            language: this.options.language,
            code: writer.toString(),
        };
    }

    private generateSlotFile(definition: SlotDefinition, path: string, name: string): ExampleFile {
        const writer = this.createWriter();

        this.writeSlotSnippet(writer, definition, name);

        return {
            path: path,
            language: this.options.language,
            code: writer.toString(),
        };
    }

    private writePageSnippet(writer: CodeWriter, pageName: string, slotFile: SlotFile): void {
        this.writePageHeader(writer, slotFile);

        writer.newLine();

        this.writePageSignature(writer, pageName);

        writer.indent()
            .write('return (')
            .indent();

        if (this.hasSuspenseBoundary()) {
            writer
                .write('<Suspense fallback="✨ Personalizing...">')
                .indent();
        }

        this.writeSlotRendering(writer, slotFile.name);

        if (this.hasSuspenseBoundary()) {
            writer
                .outdent()
                .write('</Suspense>');
        }

        writer
            .outdent()
            .write(');')
            .outdent()
            .write('}', false);
    }

    protected writeSlotRendering(writer: CodeWriter, name: string): void {
        writer.write(`<${name} />`);
    }

    protected writePageSignature(writer: CodeWriter, name: string): void {
        writer.write(
            this.options.language === CodeLanguage.TYPESCRIPT_XML
                ? `export default function ${name}(): ReactElement {`
                : `export default function ${name}() {`,
        );
    }

    protected writePageHeader(writer: CodeWriter, slot: SlotFile): void {
        switch (this.options.language) {
            case CodeLanguage.JAVASCRIPT_XML:
                if (this.hasSuspenseBoundary()) {
                    writer.write("import {Suspense} from 'react';");
                }

                break;

            case CodeLanguage.TYPESCRIPT_XML:
                writer.write(
                    this.hasSuspenseBoundary()
                        ? "import {type ReactElement, Suspense} from 'react';"
                        : "import type {ReactElement} from 'react';",
                );

                break;
        }

        writer.write(`import ${slot.name} from '${slot.importPath}';`);
    }

    private writeSlotSnippet(writer: CodeWriter, definition: SlotDefinition, name: string): void {
        this.writeSlotHeader(writer, definition);

        this.writeSlotSignature(writer, definition, name);

        writer.indent();

        this.writeSlotFetch(writer, definition);

        writer.write('return (')
            .indent();

        this.writeRenderingSnippet(writer, definition.definition, this.options.contentVariable);

        writer
            .outdent()
            .write(');')
            .outdent()
            .write('};');
    }

    protected writeSlotSignature(writer: CodeWriter, definition: SlotDefinition, name: string): void {
        writer.write(`export default ${this.isSlotFetchAsync() ? 'async ' : ''}function ${name}`, false);

        this.appendSlotParams(writer, definition);

        if (this.options.language === CodeLanguage.TYPESCRIPT_XML) {
            writer.append(`: ${this.isSlotFetchBlocking() ? 'Promise<ReactElement>' : 'ReactElement'}`);
        }

        writer.write(' {');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used by subclasses
    protected appendSlotParams(writer: CodeWriter, _: SlotDefinition): void {
        writer.append('()');
    }

    protected abstract isSlotFetchAsync(): boolean;

    protected abstract isSlotFetchBlocking(): boolean;

    protected abstract hasSuspenseBoundary(): boolean;

    protected abstract writeSlotFetch(writer: CodeWriter, definition: SlotDefinition): void;

    protected abstract writeSlotHeader(writer: CodeWriter, definition: SlotDefinition): void;

    private writeRenderingSnippet(writer: CodeWriter, definition: ContentDefinition, path: string): void {
        switch (definition.type) {
            case 'number':
            case 'text':
                writer.append(`{${path}}`);

                break;

            case 'boolean':
                if (definition.label !== undefined) {
                    writer
                        .append(`{${path} ? `)
                        .appendValue(definition.label.true ?? 'Yes', {delimiter: "'"})
                        .append(' : ')
                        .appendValue(definition.label.false ?? 'No', {delimiter: "'"})
                        .append('}');
                } else {
                    writer.append(`{${path} ? 'Yes' : 'No'}`);
                }

                break;

            case 'list': {
                const variable = definition.itemLabel !== undefined
                    ? formatName(definition.itemLabel)
                    : 'item';

                writer
                    .write('<ol>')
                    .indent()
                    .write(`{${path}.map((${variable}, index) => (`)
                    .indent()
                    .write('<li key={index}>')
                    .indent();

                const inline = ReactExampleGenerator.isInline(definition.items);

                if (inline) {
                    writer.appendIndentation();
                }

                this.writeRenderingSnippet(writer, definition.items, variable);

                if (inline) {
                    writer.newLine();
                }

                writer
                    .outdent()
                    .write('</li>')
                    .outdent()
                    .write('))}')
                    .outdent()
                    .write('</ol>');

                break;
            }

            case 'structure':
                writer
                    .write('<ul>')
                    .indent();

                for (const [name, attribute] of sortAttributes(definition.attributes)) {
                    if (attribute.private === true) {
                        continue;
                    }

                    if (attribute.optional === true) {
                        writer.write(`{${path}.${name} && (`);
                        writer.indent();
                    }

                    this.writeAttributeSnippet(writer, {name: name, ...attribute}, path);

                    if (attribute.optional === true) {
                        writer.outdent();
                        writer.write(')}');
                    }
                }

                writer
                    .outdent()
                    .write('</ul>');

                break;

            case 'union': {
                const isRoot = !path.includes('.');

                if (isRoot) {
                    writer.write('<>')
                        .indent();
                }

                for (const [id, variant] of Object.entries(definition.types)) {
                    writer
                        .write(`{${path}._type === '${id}' && (`)
                        .indent();

                    this.writeRenderingSnippet(writer, variant, path);

                    writer
                        .outdent()
                        .write(')}');
                }

                if (isRoot) {
                    writer
                        .outdent()
                        .write('</>');
                }

                break;
            }
        }
    }

    private writeAttributeSnippet(writer: CodeWriter, attribute: Attribute, path: string): void {
        const definition = attribute.type;
        const label = ReactExampleGenerator.escapeEntities(attribute.label ?? formatLabel(attribute.name));

        switch (definition.type) {
            case 'boolean':
            case 'text':
            case 'number': {
                writer
                    .write('<li>', false)
                    .append(`<strong>${label}:</strong> `);

                this.writeRenderingSnippet(writer, definition, `${path}.${attribute.name}`);

                writer.append('</li>')
                    .newLine();

                break;
            }

            default:
                writer
                    .write('<li>')
                    .indent()
                    .write(`<strong>${label}</strong>`);

                this.writeRenderingSnippet(writer, definition, `${path}.${attribute.name}`);

                writer
                    .outdent()
                    .write('</li>');

                break;
        }
    }

    private static escapeEntities(value: string): string {
        return value.replace(
            /([&"<>])/g,
            match => ({
                '&': '&amp;',
                '"': '&quot;',
                '<': '&lt;',
                '>': '&gt;',
            }[match] ?? match),
        );
    }

    private createWriter(): CodeWriter {
        return new CodeWriter(this.options.indentationSize);
    }

    private static replaceVariables(path: string, id: string): string {
        return path.replace(/%name%/g, ReactExampleGenerator.formatName(id, true))
            .replace(/%slug%/g, formatSlug(id));
    }

    private static formatName(name: string, capitalize = false): string {
        return CodeWriter.formatName(name, capitalize);
    }

    private static isInline(definition: ContentDefinition): boolean {
        return ['number', 'text', 'boolean'].includes(definition.type);
    }
}
