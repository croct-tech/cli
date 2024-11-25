import {join} from 'path';
import {SlotDefinition, SlotExampleGenerator} from './slotExampleGenerator';
import {CodeExample, CodeLanguage, ExampleFile} from '@/application/project/example/example';
import {AttributeDefinition, ContentDefinition} from '@/application/project/example/content-model/definitions';
import {CodeWriter} from '@/application/project/example/codeWritter';
import {formatLabel, sortAttributes} from '@/application/project/example/utils';

export type ReactExampleGeneratorOptions = {
    language: CodeLanguage.JAVASCRIPT_XML | CodeLanguage.TYPESCRIPT_XML,
    indentationSize?: number,
    code: {
        variables?: {
            content?: string,
            fallbackContent?: string,
        },
        importPaths: {
            slot: string,
        },
        files?: {
            slot?: {
                directory?: string,
                name?: string,
            },
            page?: {
                directory?: string,
                name?: string,
            },
        },
    },
};

type Attribute = AttributeDefinition & {
    name: string,
};

export type SlotFile = {
    name: string,
    path: string,
    definition: SlotDefinition,
};

type DeepRequired<T> = Required<{
    [P in keyof T]: T[P] extends object | undefined ? DeepRequired<Required<T[P]>> : T[P];
}>;

export abstract class ReactExampleGenerator implements SlotExampleGenerator {
    protected readonly options: DeepRequired<ReactExampleGeneratorOptions>;

    public constructor(options: ReactExampleGeneratorOptions) {
        this.options = {
            ...options,
            indentationSize: options.indentationSize ?? 2,
            code: {
                variables: {
                    content: options.code?.variables?.content ?? 'content',
                    fallbackContent: options.code?.variables?.fallbackContent ?? 'fallbackContent',
                },
                importPaths: {
                    slot: options.code?.importPaths.slot ?? '',
                },
                files: {
                    slot: {
                        directory: options.code?.files?.slot?.directory ?? '',
                        name: options.code?.files?.slot?.name ?? '',
                    },
                    page: {
                        directory: options.code?.files?.page?.directory ?? '',
                        name: options.code?.files?.page?.name ?? '',
                    },
                },
            },
        };
    }

    public generate(definition: SlotDefinition): CodeExample {
        const slotFile = this.generateSlotFile(definition);
        const parts = slotFile.name
            .replace(/\..+$/, '')
            .split('/');

        const slotFileName = parts.length > 1 && parts[parts.length - 1] === this.addExtension('index')
            ? parts[parts.length - 2]
            : parts[parts.length - 1];

        return {
            files: [
                this.generatePageFile(definition, slotFileName),
                slotFile,
            ],
        };
    }

    private generatePageFile(definition: SlotDefinition, slotFile: string): ExampleFile {
        const writer = this.createWriter();

        this.writePageSnippet(writer, definition, slotFile);

        const name = ReactExampleGenerator.formatName(`${definition.id}Example`, true);
        const pageFile = this.options.code.files.page;
        const fileName = pageFile.name !== '' ? pageFile.name : name;

        return {
            name: join(
                ReactExampleGenerator.resolveDirectoryPath(pageFile.directory, name),
                this.addExtension(fileName),
            ),
            language: this.options.language,
            code: writer.toString(),
        };
    }

    private generateSlotFile(definition: SlotDefinition): ExampleFile {
        const writer = this.createWriter();

        this.writeSlotSnippet(writer, definition);

        const name = ReactExampleGenerator.formatName(definition.id, true);
        const slotFile = this.options.code.files.slot;
        const fileName = slotFile.name !== '' ? slotFile.name : name;

        return {
            name: join(
                ReactExampleGenerator.resolveDirectoryPath(slotFile.directory, name),
                this.addExtension(fileName),
            ),
            language: this.options.language,
            code: writer.toString(),
        };
    }

    private writePageSnippet(writer: CodeWriter, definition: SlotDefinition, slotFile: string): void {
        const slotName = CodeWriter.formatName(definition.id, true);
        const slotPath = this.options.code.importPaths.slot;
        const slotFilePath = `${slotPath}/${slotFile}`;

        this.writePageHeader(writer, {
            name: slotName,
            path: slotFilePath,
            definition: definition,
        });

        writer.newLine();

        this.writePageSignature(writer);

        writer.indent()
            .write('return (')
            .indent();

        if (this.hasSuspenseBoundary()) {
            writer
                .write('<Suspense fallback="✨ Personalizing...">')
                .indent();
        }

        this.writeSlotRendering(writer, slotName);

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

    protected writePageSignature(writer: CodeWriter): void {
        writer.write(
            this.options.language === CodeLanguage.TYPESCRIPT_XML
                ? 'export default function Page(): ReactElement {'
                : 'export default function Page() {',
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

        writer.write(`import ${slot.name} from '${slot.path}';`);
    }

    private writeSlotSnippet(writer: CodeWriter, definition: SlotDefinition): void {
        this.writeSlotHeader(writer, definition);

        this.writeSlotSignature(writer, definition);

        writer.indent();

        this.writeSlotFetch(writer, definition);

        writer.write('return (')
            .indent();

        this.writeRenderingSnippet(writer, definition.definition);

        writer.outdent()
            .write(');')
            .outdent()
            .write('};');
    }

    protected writeSlotSignature(writer: CodeWriter, definition: SlotDefinition): void {
        const slotName = CodeWriter.formatName(definition.id, true);

        writer.write(`export default ${this.isSlotFetchAsync() ? 'async ' : ''}function ${slotName}`, false);

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

    private writeRenderingSnippet(writer: CodeWriter, definition: ContentDefinition, path?: string): void {
        if (path === undefined) {
            writer.write('<div>')
                .indent();
        }

        const actualPath = path ?? this.options.code.variables.content;

        switch (definition.type) {
            case 'structure':
                for (const [name, attribute] of sortAttributes(definition.attributes)) {
                    if (attribute.private === true) {
                        continue;
                    }

                    if (attribute.optional === true) {
                        writer.write(`{${actualPath}.${name} && (`);
                        writer.indent();
                    }

                    this.writeAttributeSnippet(writer, {name: name, ...attribute}, actualPath);

                    if (attribute.optional === true) {
                        writer.outdent();
                        writer.write(')}');
                    }
                }

                break;

            case 'union':
                for (const [id, variant] of Object.entries(definition.types)) {
                    writer
                        .write(`{/* Render the ${id} variant */}`)
                        .write(`{${actualPath}._type === '${id}' && (`)
                        .indent()
                        .write('<div>')
                        .indent();

                    this.writeRenderingSnippet(writer, variant, actualPath);

                    writer
                        .outdent()
                        .write('</div>')
                        .outdent()
                        .write(')}');
                }

                break;
        }

        if (path === undefined) {
            writer.outdent()
                .write('</div>');
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
                    .write('<div>', false)
                    .append(`${label}: `)
                    .append(
                        definition.type === 'boolean'
                            ? `{${path}.${attribute.name} ? 'Yes' : 'No'}`
                            : `{${path}.${attribute.name}}`,
                    )
                    .append('</div>')
                    .newLine();

                break;
            }

            case 'list':
                writer
                    .write('<div>')
                    .indent()
                    .write(`<strong>${label}</strong>`)
                    .write(`{${path}.${attribute.name}.map((item, index) => (`)
                    .indent()
                    .write('<div key={index}>')
                    .indent();

                this.writeRenderingSnippet(writer, definition.items, 'item');

                writer
                    .outdent()
                    .write('</div>')
                    .outdent()
                    .write('))}')
                    .outdent()
                    .write('</div>');

                break;

            case 'reference':
                writer
                    .write('<div>')
                    .indent()
                    .write(`${label}: `)
                    .write('<', false)
                    .appendName(definition.id)
                    .append(' {...')
                    .append(`${path}.${attribute.name}`)
                    .append('} />')
                    .outdent()
                    .newLine()
                    .write('</div>');

                break;

            default:
                writer
                    .write('<div>')
                    .indent()
                    .write(`<strong>${label}</strong>`);

                this.writeRenderingSnippet(writer, definition, `${path}.${attribute.name}`);

                writer
                    .outdent()
                    .write('</div>');

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

    private addExtension(fileName: string): string {
        return `${fileName}.${CodeLanguage.getExtension(this.options.language)}`;
    }

    private static resolveDirectoryPath(directory: string, name: string): string {
        return directory.replace(/%name%/g, name);
    }

    private static formatName(name: string, capitalize = false): string {
        return CodeWriter.formatName(name, capitalize);
    }
}
