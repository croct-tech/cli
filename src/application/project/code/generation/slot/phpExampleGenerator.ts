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
 * Generates a runnable PHP page that renders a slot's content.
 *
 * Walks the slot's resolved definition and renders each field by array key,
 * relying on the generated typing stub so the content is statically typed and
 * needs no casts. Subclasses provide the bootstrap that fetches the content.
 */
export abstract class PhpExampleGenerator implements SlotExampleGenerator {
    protected readonly options: Configuration;

    public constructor(options: Configuration) {
        this.options = options;
    }

    public generate(definition: SlotDefinition): CodeExample {
        const path = PhpExampleGenerator.replaceVariables(this.options.filePath, definition.id);
        const writer = new CodeWriter(this.options.indentationSize);
        const variable = `$${this.options.contentVariable}`;
        const title = PhpExampleGenerator.escapeEntities(PhpExampleGenerator.formatTitle(definition.id));

        this.writeScript(writer, definition);

        writer.newLine()
            .write('<!doctype html>')
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

        writer.newLine();

        this.writeHandoff(writer);

        writer.outdent()
            .write('</body>')
            .write('</html>', false);

        return {
            files: [
                {
                    path: path,
                    language: CodeLanguage.PHP,
                    code: writer.toString(),
                },
            ],
        };
    }

    protected abstract writeScript(writer: CodeWriter, definition: SlotDefinition): void;

    protected writeHandoff(writer: CodeWriter): void {
        writer.write('<script src="https://cdn.croct.io/js/v1/lib/plug.js"></script>')
            .write('<script>')
            .indent()
            .write('croct.plug(<?= json_encode($croct->getPlugOptions()) ?>);')
            .outdent()
            .write('</script>');
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
        const label = PhpExampleGenerator.escapeEntities(attribute.label ?? formatLabel(attribute.name));
        const optional = attribute.optional === true;

        if (optional) {
            writer.write(`<?php if (isset(${path})): ?>`)
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
                .write('<?php endif; ?>');
        }
    }

    private writeFragment(writer: CodeWriter, definition: ContentDefinition, path: string): void {
        switch (definition.type) {
            case 'text':
                writer.append(`<?= htmlspecialchars(${path}) ?>`);

                break;

            case 'number':
                writer.append(`<?= ${path} ?>`);

                break;

            case 'boolean':
                writer.append(PhpExampleGenerator.formatBoolean(definition, path));

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
            .write(`<?php foreach (${path} as ${itemPath}): ?>`)
            .indent();

        if (PhpExampleGenerator.isInline(definition.items)) {
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
            .write('<?php endforeach; ?>')
            .outdent()
            .write('</ol>');
    }

    private writeUnion(writer: CodeWriter, definition: ContentDefinition<'union'>, path: string): void {
        for (const [id, variant] of Object.entries(definition.types)) {
            writer.write(`<?php if (${path}['_type'] === '${PhpExampleGenerator.escapeString(id)}'): ?>`)
                .indent();

            this.writeFragment(writer, variant, path);

            writer.outdent()
                .write('<?php endif; ?>');
        }
    }

    private static formatBoolean(definition: ContentDefinition<'boolean'>, path: string): string {
        const trueLabel = PhpExampleGenerator.escapeString(definition.label?.true ?? 'Yes');
        const falseLabel = PhpExampleGenerator.escapeString(definition.label?.false ?? 'No');

        return `<?= ${path} ? '${trueLabel}' : '${falseLabel}' ?>`;
    }

    private static isInline(definition: ContentDefinition): boolean {
        return ['number', 'text', 'boolean'].includes(definition.type);
    }

    protected static escapeString(value: string): string {
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
