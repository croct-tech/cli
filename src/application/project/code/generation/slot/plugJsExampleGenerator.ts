import {AttributeDefinition, ContentDefinition} from '@croct/content-model/definition/definition';
import {JsonValue} from '@croct/json';
import {SlotDefinition, SlotExampleGenerator} from './slotExampleGenerator';
import {CodeExample, CodeLanguage, ExampleFile} from '@/application/project/code/generation/example';
import {CodeWriter} from '@/application/project/code/generation/codeWritter';
import {formatLabel, sortAttributes} from '@/application/project/code/generation/utils';
import {FileSystem} from '@/application/fs/fileSystem';
import {formatName} from '@/application/project/utils/formatName';

export type Configuration = {
    fileSystem: FileSystem,
    language: CodeLanguage.JAVASCRIPT | CodeLanguage.TYPESCRIPT,
    appId: string,
    indentationSize?: number,
    fallbackContent?: JsonValue,
    containerId: string,
    slotPath: string,
    pagePath: string,
};

export class PlugJsExampleGenerator implements SlotExampleGenerator {
    protected readonly options: Omit<Configuration, 'fileSystem'>;

    private readonly fileSystem: FileSystem;

    public constructor({fileSystem, ...options}: Configuration) {
        this.options = options;
        this.fileSystem = fileSystem;
    }

    public generate(definition: SlotDefinition): CodeExample {
        const slotFile = this.generateSlotFile(definition);

        return {
            files: [
                this.generatePageFile(definition, slotFile.path),
                slotFile,
            ],
        };
    }

    private generatePageFile(definition: SlotDefinition, slotFile: string): ExampleFile {
        const writer = this.createWriter();

        this.writePageSnippet(
            writer,
            definition.definition.title ?? 'Croct example',
            this.fileSystem.getRelativePath(
                this.fileSystem.getDirectoryName(this.options.pagePath),
                slotFile,
            ).replace(/\\/g, '/'),
        );

        return {
            path: this.options.pagePath,
            language: CodeLanguage.HTML,
            code: writer.toString(),
        };
    }

    private writePageSnippet(writer: CodeWriter, slotName: string, slotFile: string): void {
        writer
            .write('<html lang="en">')
            .write('<head>')
            .indent()
            .write('<meta charset="UTF-8">')
            .write(`<title>${PlugJsExampleGenerator.escapeEntities(slotName)}</title>`)
            .write(`<script type="module" src="${slotFile}"></script>`)
            .outdent()
            .write('</head>')
            .write('<body>')
            .indent()
            .write(`<div id="${this.options.containerId}"></div>`)
            .outdent()
            .write('</body>')
            .write('</html>', false);
    }

    private generateSlotFile(definition: SlotDefinition): ExampleFile {
        const writer = this.createWriter();

        this.writeSlotSnippet(writer, definition);

        return {
            path: this.options.slotPath,
            language: this.options.language,
            code: writer.toString(),
        };
    }

    private writeSlotSnippet(writer: CodeWriter, definition: SlotDefinition): void {
        writer.write('import croct from \'@croct/plug\';');

        writer
            .newLine()
            .write(`croct.plug({appId: '${this.options.appId}'});`)
            .newLine();

        this.renderListener(writer, definition);
    }

    private renderListener(writer: CodeWriter, definition: SlotDefinition): void {
        writer
            .write('document.addEventListener(\'DOMContentLoaded\', async () => {')
            .indent();

        writer
            .write('const {content} = ', false)
            .append(`await croct.fetch('${definition.id}@${definition.version}'`);

        if (this.options.fallbackContent !== undefined) {
            writer.append(', {')
                .indent()
                .newLine()
                .write('fallback: ', false)
                .appendValue(this.options.fallbackContent, {
                    delimiter: '\'',
                })
                .newLine()
                .outdent()
                .write('}', false);
        }

        writer.append(');');

        writer
            .newLine(2)
            .write(`document.querySelector('#${this.options.containerId}')`, false);

        if (this.options.language === CodeLanguage.TYPESCRIPT) {
            writer.append('!');
        }

        writer
            .append('.innerHTML = `')
            .newLine()
            .indent();

        this.writeContentSnippet(writer, definition.definition, 'content');

        writer
            .outdent()
            .write('`;')
            .outdent()
            .write('});');
    }

    private writeContentSnippet(writer: CodeWriter, definition: ContentDefinition, path: string): void {
        switch (definition.type) {
            case 'text':
            case 'number':
                writer.append(`\${${path}}`);

                break;

            case 'boolean':
                if (definition.label !== undefined) {
                    writer
                        .append(`\${${path} ? `)
                        .appendValue(definition.label.true ?? 'Yes', {delimiter: "'"})
                        .append(' : ')
                        .appendValue(definition.label.false ?? 'No', {delimiter: "'"})
                        .append('}');
                } else {
                    writer.append(`\${${path} ? 'Yes' : 'No'}`);
                }

                break;

            case 'list': {
                const variable = definition.itemLabel !== undefined
                    ? formatName(definition.itemLabel)
                    : 'item';

                writer
                    .write('<ol>')
                    .indent()
                    .write(`\${${path}.map(${variable} => \``)
                    .indent()
                    .write('<li>')
                    .indent();

                const inline = PlugJsExampleGenerator.isInline(definition.items);

                if (inline) {
                    writer.appendIndentation();
                }

                this.writeContentSnippet(writer, definition.items, variable);

                if (inline) {
                    writer.newLine();
                }

                writer
                    .outdent()
                    .write('</li>')
                    .outdent()
                    .write("`).join('')}")
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
                        writer.write(`\${${path}.${name} && \``);
                        writer.indent();
                    }

                    this.writeAttributeSnippet(writer, attribute, `${path}.${name}`);

                    if (attribute.optional === true) {
                        writer.outdent();
                        writer.write('`}');
                    }
                }

                writer
                    .outdent()
                    .write('</ul>');

                break;

            case 'union':
                for (const [id, variant] of Object.entries(definition.types)) {
                    writer
                        .write(`\${${path}._type === '${id}' && \``)
                        .indent();

                    this.writeContentSnippet(writer, variant, path);

                    writer
                        .outdent()
                        .write('`}');
                }

                break;
        }
    }

    private writeAttributeSnippet(writer: CodeWriter, attribute: AttributeDefinition, path: string): void {
        const definition = attribute.type;
        const label = attribute.label !== undefined
            ? PlugJsExampleGenerator.escapeEntities(attribute.label)
                .replace(/`/g, '\\`')
            : formatLabel(path.split('.').pop()!);

        switch (definition.type) {
            case 'boolean':
            case 'text':
            case 'number': {
                writer
                    .write('<li>', false)
                    .append(`<strong>${label}:</strong> `);

                this.writeContentSnippet(writer, definition, path);

                writer.append('</li>')
                    .newLine();

                break;
            }

            default:
                writer
                    .write('<li>')
                    .indent()
                    .write(`<strong>${label}</strong>`);

                this.writeContentSnippet(writer, definition, path);

                writer
                    .outdent()
                    .write('</li>');

                break;
        }
    }

    private static isInline(definition: ContentDefinition): boolean {
        return ['number', 'text', 'boolean'].includes(definition.type);
    }

    private static escapeEntities(value: string): string {
        return value.replace(
            /([&<>])/g,
            match => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
            }[match] ?? match),
        );
    }

    private createWriter(): CodeWriter {
        return new CodeWriter(this.options.indentationSize);
    }
}
