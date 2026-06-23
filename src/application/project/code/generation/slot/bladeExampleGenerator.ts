import type {
    AttributeDefinition,
    ContentDefinition,
    RootDefinition,
} from '@croct/content-model/definition/definition';
import type {SlotDefinition, SlotExampleGenerator} from './slotExampleGenerator';
import type {CodeExample} from '@/application/project/code/generation/example';
import {CodeLanguage} from '@/application/project/code/generation/example';
import {CodeWriter} from '@/application/project/code/generation/codeWritter';
import {formatLabel, formatSlug, sortAttributes} from '@/application/project/code/generation/utils';
import {formatName} from '@/application/project/utils/formatName';

export type Configuration = {
    indentationSize?: number,
    contentVariable: string,
    filePath: string,
};

type Attribute = AttributeDefinition & {
    name: string,
};

/**
 * Generates a Blade view that renders a slot's content.
 *
 * Walks the slot's resolved definition and renders each field by array key,
 * relying on the typed content provided by the controller. The plug.js script
 * is injected by the Croct middleware, so the view only renders content.
 */
export class BladeExampleGenerator implements SlotExampleGenerator {
    private readonly options: Configuration;

    public constructor(options: Configuration) {
        this.options = options;
    }

    public generate(definition: SlotDefinition): CodeExample {
        const path = BladeExampleGenerator.replaceVariables(this.options.filePath, definition.id);
        const writer = new CodeWriter(this.options.indentationSize);
        const variable = `$${this.options.contentVariable}`;
        const title = BladeExampleGenerator.escapeEntities(BladeExampleGenerator.formatTitle(definition.id));

        writer.write('<!doctype html>')
            .write('<html lang="en">')
            .write('<head>')
            .indent()
            .write('<meta charset="utf-8">')
            .write(`<title>${title}</title>`)
            .outdent()
            .write('</head>')
            .write('<body>')
            .indent();

        this.writeRoot(writer, definition.definition, variable);

        writer.outdent()
            .write('</body>')
            .write('</html>', false);

        return {
            files: [
                {
                    path: path,
                    language: CodeLanguage.BLADE,
                    code: writer.toString(),
                },
            ],
        };
    }

    private writeRoot(writer: CodeWriter, definition: RootDefinition, path: string): void {
        if (definition.type === 'union') {
            this.writeUnion(writer, definition, path);

            return;
        }

        writer.write('<ul>')
            .indent();

        this.writeStructureAttributes(writer, definition, path);

        writer.outdent()
            .write('</ul>');
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
        const path = `${parentPath}['${attribute.name}']`;
        const definition = attribute.type;
        const label = BladeExampleGenerator.escapeEntities(attribute.label ?? formatLabel(attribute.name));
        const optional = attribute.optional === true;

        if (optional) {
            writer.write(`@isset(${path})`)
                .indent();
        }

        switch (definition.type) {
            case 'boolean':
            case 'text':
            case 'number':
                writer.write(`<li><strong>${label}:</strong> `, false);

                this.writeFragment(writer, definition, path);

                writer.append('</li>')
                    .newLine();

                break;

            default:
                writer.write('<li>')
                    .indent()
                    .write(`<strong>${label}</strong>`);

                this.writeFragment(writer, definition, path);

                writer.outdent()
                    .write('</li>');

                break;
        }

        if (optional) {
            writer.outdent()
                .write('@endisset');
        }
    }

    private writeFragment(writer: CodeWriter, definition: ContentDefinition, path: string): void {
        switch (definition.type) {
            case 'text':
            case 'number':
                writer.append(`{{ ${path} }}`);

                break;

            case 'boolean':
                writer.append(BladeExampleGenerator.formatBoolean(definition, path));

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
        const itemPath = `$${variable}`;

        writer.write('<ol>')
            .indent()
            .write(`@foreach (${path} as ${itemPath})`)
            .indent();

        if (BladeExampleGenerator.isInline(definition.items)) {
            writer.write('<li>', false);

            this.writeFragment(writer, definition.items, itemPath);

            writer.append('</li>')
                .newLine();
        } else {
            writer.write('<li>')
                .indent();

            this.writeFragment(writer, definition.items, itemPath);

            writer.outdent()
                .write('</li>');
        }

        writer.outdent()
            .write('@endforeach')
            .outdent()
            .write('</ol>');
    }

    private writeUnion(writer: CodeWriter, definition: ContentDefinition<'union'>, path: string): void {
        for (const [id, variant] of Object.entries(definition.types)) {
            writer.write(`@if (${path}['_type'] === '${BladeExampleGenerator.escapeString(id)}')`)
                .indent();

            this.writeFragment(writer, variant, path);

            writer.outdent()
                .write('@endif');
        }
    }

    private static formatBoolean(definition: ContentDefinition<'boolean'>, path: string): string {
        const trueLabel = BladeExampleGenerator.escapeString(definition.label?.true ?? 'Yes');
        const falseLabel = BladeExampleGenerator.escapeString(definition.label?.false ?? 'No');

        return `{{ ${path} ? '${trueLabel}' : '${falseLabel}' }}`;
    }

    private static isInline(definition: ContentDefinition): boolean {
        return ['number', 'text', 'boolean'].includes(definition.type);
    }

    private static escapeString(value: string): string {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'");
    }

    private static escapeEntities(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private static formatTitle(id: string): string {
        return formatSlug(id)
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    private static replaceVariables(path: string, id: string): string {
        return path.replace(/%slug%/g, formatSlug(id));
    }
}
