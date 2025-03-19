import {AttributeDefinition, ContentDefinition} from '@croct/content-model/definition/definition';
import {SlotDefinition, SlotExampleGenerator} from './slotExampleGenerator';
import {CodeExample, CodeLanguage, ExampleFile} from '@/application/project/code/generation/example';
import {CodeWriter} from '@/application/project/code/generation/codeWritter';
import {formatLabel, sortAttributes} from '@/application/project/code/generation/utils';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration = {
    fileSystem: FileSystem,
    options: {
        language: CodeLanguage.JAVASCRIPT | CodeLanguage.TYPESCRIPT,
        appId: string,
        indentationSize?: number,
        fallbackContent?: boolean,
        code?: {
            browser?: boolean,
            containerElementId?: string,
            variables?: {
                container?: string,
            },
            paths?: {
                slot?: string,
                page?: string,
            },
        },
    },
};

type DeepRequired<T> = Required<{
    [P in keyof T]: T[P] extends object | undefined ? DeepRequired<Required<T[P]>> : T[P];
}>;

export class PlugJsExampleGenerator implements SlotExampleGenerator {
    protected readonly config: DeepRequired<Configuration['options']>;

    private readonly fileSystem: FileSystem;

    public constructor({fileSystem, options}: Configuration) {
        this.config = {
            ...options,
            language: options.language ?? CodeLanguage.JAVASCRIPT,
            indentationSize: options.indentationSize ?? 2,
            fallbackContent: options.fallbackContent ?? false,
            code: {
                browser: options.code?.browser ?? false,
                containerElementId: options.code?.containerElementId ?? 'slot',
                variables: {
                    container: options.code?.variables?.container ?? 'container',
                },
                paths: {
                    slot: options.code?.paths?.slot ?? '',
                    page: options.code?.paths?.page ?? '',
                },
            },
        };

        this.fileSystem = fileSystem;
    }

    public generate(definition: SlotDefinition): CodeExample {
        const slotFile = this.generateSlotFile(definition);

        return {
            files: [
                this.generatePageFile(definition, slotFile.name),
                slotFile,
            ],
        };
    }

    private generatePageFile(definition: SlotDefinition, slotFile: string): ExampleFile {
        const writer = this.createWriter();

        const path = this.fileSystem.joinPaths(
            this.config.code.paths.page,
            `${this.addExtension(this.formatFileName(definition.id, false), CodeLanguage.HTML)}`,
        );

        this.writePageSnippet(
            writer,
            this.fileSystem.getRelativePath(this.config.code.paths.page, slotFile).replace(/\\/g, '/'),
        );

        return {
            name: path,
            language: CodeLanguage.HTML,
            code: writer.toString(),
        };
    }

    private writePageSnippet(writer: CodeWriter, slotFile: string): void {
        writer
            .write('<html>')
            .write('<head>')
            .indent()
            .write('<meta charset="UTF-8">')
            .write(`<script type="module" src="${slotFile}"></script>`)
            .outdent()
            .write('</head>')
            .write('<body>')
            .indent()
            .write(`<div id="${this.config.code.containerElementId}"></div>`)
            .outdent()
            .write('</body>')
            .write('</html>', false);
    }

    private generateSlotFile(definition: SlotDefinition): ExampleFile {
        const writer = this.createWriter();

        this.writeSlotSnippet(writer, definition);

        return {
            name: this.fileSystem.joinPaths(
                this.config.code.paths.slot,
                `${this.addExtension(this.formatFileName(definition.id, false))}`,
            ),
            language: this.config.language,
            code: writer.toString(),
        };
    }

    private writeSlotSnippet(writer: CodeWriter, definition: SlotDefinition): void {
        const {variables} = this.config.code;

        writer.write('import croct from \'@croct/plug\';');

        if (this.config.fallbackContent) {
            writer.write('import {loadSlotContent} from \'@croct/content/slot\';');
        }

        const functionName = `render${CodeWriter.formatName(definition.id, true)}`;

        writer
            .newLine()
            .write(`croct.plug({appId: '${this.config.appId}'});`)
            .newLine()
            .write('document.addEventListener(\'DOMContentLoaded\', () => {')
            .indent()
            .write(`${functionName}(document.querySelector('#${this.config.code.containerElementId}')`, false);

        if (this.config.language === CodeLanguage.TYPESCRIPT) {
            writer.append('!');
        }

        writer
            .append(');')
            .outdent()
            .newLine()
            .write('});', false);

        writer.newLine(2);

        let functionSignature = '';

        functionSignature += `async function ${functionName}(`;

        functionSignature += variables.container;

        if (this.config.language === CodeLanguage.TYPESCRIPT) {
            functionSignature += ': HTMLElement';
        }

        functionSignature += ')';

        if (this.config.language === CodeLanguage.TYPESCRIPT) {
            functionSignature += ': Promise<void>';
        }

        writer.write(`${functionSignature} {`)
            .indent();

        writer.write('// Display a loading message while the content is being fetched')
            .write(`${variables.container}.append('✨ Personalizing...');`)
            .newLine();

        writer
            .write('const {content} = ', false)
            .append(`await croct.fetch('${definition.id}@${definition.version}')`);

        if (this.config.fallbackContent) {
            writer
                .indent()
                .newLine()
                .write(`.catch(() => ({content: loadSlotContent('${definition.id}@${definition.version}')}))`)
                .outdent();
        }

        writer
            .append(';')
            .newLine(2)
            .write('// Remove the loading message')
            .write(`${variables.container}.replaceChildren();`)
            .newLine();

        writer.write('// Render the content');

        this.writeRenderingSnippet(
            writer,
            definition.definition,
            Scope.fromReferences({
                root: 'container',
                elements: [],
                attributes: ['content'],
            }),
        );

        writer
            .outdent()
            .write('}', false);
    }

    private writeRenderingSnippet(writer: CodeWriter, definition: ContentDefinition, scope: Scope): void {
        switch (definition.type) {
            case 'boolean':
            case 'text':
            case 'number': {
                const elementVariable = scope.getElementVariable();

                writer
                    .write(`const ${elementVariable} = `, false)
                    .append('document.createElement(\'div\');')
                    .newLine()
                    .write(`${elementVariable}.append(`, false);

                if (definition.type === 'boolean') {
                    writer.append(`${scope.getAttributeReference()} ? 'Yes' : 'No'`);
                } else {
                    writer.append(`${scope.getAttributeReference()}`);
                }

                writer
                    .append(');')
                    .newLine()
                    .write(`${scope.getParentElementVariable()}.append(${elementVariable});`);

                break;
            }

            case 'list': {
                writer
                    .write(`const ${scope.getElementVariable()} = `, false)
                    .append('document.createElement(\'div\');')
                    .newLine(1);

                const itemScope = scope
                    .push({attributes: [], elements: ['item']})
                    .withReferences({attributes: [scope.getVariable('item')]});

                writer
                    .newLine()
                    .write(`for (const ${itemScope.getVariable()} of ${scope.getAttributeReference()}) {`)
                    .indent();

                if (definition.itemLabel !== undefined) {
                    const titleVariable = scope.getVariable('itemTitleElement');

                    writer
                        .write(`const ${titleVariable} = `, false)
                        .append('document.createElement(\'strong\');')
                        .newLine()
                        .write(`${titleVariable}.append(`, false)
                        .appendString(formatLabel(definition.itemLabel), "'")
                        .append(');')
                        .newLine()
                        .write(`${scope.getElementVariable()}.append(${titleVariable});`);
                }

                this.writeRenderingSnippet(writer, definition.items, itemScope);

                writer
                    .outdent()
                    .write('}');

                writer
                    .newLine()
                    .write(`${scope.getParentElementVariable()}.append(${scope.getElementVariable()});`);

                break;
            }

            case 'reference': {
                const functionName = `render${CodeWriter.formatName(definition.id, true)}`;
                const titleVariable = scope.getVariable('titleElement');

                writer
                    .write(`${functionName}(${scope.getAttributeReference()});`)
                    .newLine()
                    .write(`${scope.getParentElementVariable()}.append(${titleVariable});`);

                break;
            }

            case 'structure': {
                const elementVariable = scope.getElementVariable();

                writer
                    .write(`const ${elementVariable} = `, false)
                    .append('document.createElement(\'div\');')
                    .newLine();

                for (const [name, attribute] of sortAttributes(definition.attributes)) {
                    if (attribute.private === true) {
                        continue;
                    }

                    if (attribute.optional === true) {
                        writer
                            .newLine()
                            .write(`if (${scope.getAttributeReference(name)} !== undefined) {`, false)
                            .indent();
                    }

                    this.writeAttributeSnippet(
                        writer,
                        attribute,
                        scope.push({
                            elements: [name],
                            attributes: [name],
                        }),
                    );

                    if (attribute.optional === true) {
                        writer.outdent();
                        writer.write('}');
                    }
                }

                writer
                    .newLine()
                    .write(`${scope.getParentElementVariable()}.append(${elementVariable});`);

                break;
            }

            case 'union': {
                writer.write(`switch (${scope.getAttributeReference()}._type) {`)
                    .indent();

                const variations = Object.entries(definition.types);

                for (let index = 0; index < variations.length; index++) {
                    const [id, variant] = variations[index];

                    writer.write(`case '${id}': {`)
                        .indent();

                    this.writeRenderingSnippet(writer, variant, scope);

                    writer
                        .newLine()
                        .write('break;')
                        .outdent()
                        .write('}');

                    if (index < variations.length - 1) {
                        writer.newLine();
                    }
                }

                writer.outdent()
                    .write('}');

                break;
            }
        }
    }

    private writeAttributeSnippet(writer: CodeWriter, attribute: AttributeDefinition, scope: Scope): void {
        const definition = attribute.type;
        const label = attribute.label ?? formatLabel(scope.getAttributeName());

        const titleVariable = scope.getVariable('titleElement');

        writer
            .newLine()
            .write(`const ${titleVariable} = `, false)
            .append('document.createElement(\'strong\');')
            .newLine()
            .write(`${titleVariable}.append(`, false)
            .appendString(label, "'")
            .append(');')
            .newLine()
            .write(`${scope.getParentElementVariable()}.append(${titleVariable});`)
            .newLine();

        this.writeRenderingSnippet(writer, definition, scope);
    }

    private createWriter(): CodeWriter {
        return new CodeWriter(this.config.indentationSize);
    }

    private formatFileName(name: string, capitalize: boolean): string {
        return `${CodeWriter.formatName(name, capitalize)}`;
    }

    private addExtension(fileName: string, language?: CodeLanguage): string {
        return `${fileName}.${CodeLanguage.getExtension(language ?? this.config.language)}`;
    }
}

type ScopeReferences = {
    root: string,
    elements: string[],
    attributes: string[],
};

class Scope {
    private readonly references: ScopeReferences;

    private constructor(references: ScopeReferences) {
        this.references = references;
    }

    public static fromReferences(references: ScopeReferences): Scope {
        return new Scope(references);
    }

    public push(references: Omit<ScopeReferences, 'root'>): Scope {
        return Scope.fromReferences({
            root: this.references.root,
            elements: [...this.references.elements, ...(references.elements)],
            attributes: [...this.references.attributes, ...(references.attributes)],
        });
    }

    public withReferences(references: Partial<ScopeReferences>): Scope {
        return Scope.fromReferences({
            root: this.references.root,
            elements: references.elements ?? this.references.elements,
            attributes: references.attributes ?? this.references.attributes,
        });
    }

    public getElementVariable(): string {
        return Scope.formatElementVariable(this.references.elements);
    }

    public getParentElementVariable(): string {
        if (this.references.elements.length === 0) {
            return this.references.root;
        }

        return Scope.formatElementVariable(this.references.elements.slice(0, -1));
    }

    public getVariable(suffix: string = ''): string {
        return Scope.formatName(this.references.elements, suffix);
    }

    public getAttributeReference(attribute: string = ''): string {
        return (attribute === '' ? this.references.attributes : [...this.references.attributes, attribute]).join('.');
    }

    public getAttributeName(): string {
        return this.references.attributes[this.references.attributes.length - 1];
    }

    private static formatElementVariable(variables: string[]): string {
        return Scope.formatName(variables, 'element');
    }

    private static formatName(variables: string[], suffix: string): string {
        if (variables.length === 0) {
            return suffix;
        }

        if (variables.some(variable => variable.includes('_'))) {
            return `${variables.join('_')}${suffix === '' ? '' : `_${suffix}`}`;
        }

        return CodeWriter.formatName(`${variables.join('.')}${suffix === '' ? '' : `.${suffix}`}`, false);
    }
}
