import type {SlotDefinition, SlotExampleGenerator} from './slotExampleGenerator';
import type {CodeExample} from '@/application/project/code/generation/example';
import {CodeLanguage} from '@/application/project/code/generation/example';
import {CodeWriter} from '@/application/project/code/generation/codeWritter';
import {formatSlug} from '@/application/project/code/generation/utils';

/**
 * The Hydrogen era, which selects the routing imports.
 *
 * - `react-router`: React Router 7 (`react-router`, route `+types`).
 * - `remix`: Remix v2 (`@remix-run/react`, `@shopify/remix-oxygen`).
 */
export type HydrogenEra = 'react-router' | 'remix';

export type Configuration = {
    typescript: boolean,
    era: HydrogenEra,
    routeFilePath: string,
    routeComponentName: string,
    indentationSize?: number,
};

/**
 * Generates a Hydrogen route that renders a slot.
 *
 * The route fetches the slot content server-side in a `loader` via
 * `fetchContent('<slug>', {context})` and renders it with `<Slot initial={...}>`, so the content
 * is server-rendered and revalidated on the client. The routing imports follow the era.
 */
export class HydrogenExampleGenerator implements SlotExampleGenerator {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public generate(definition: SlotDefinition): CodeExample {
        const slug = formatSlug(definition.id);
        const writer = new CodeWriter(this.configuration.indentationSize);

        this.writeRoute(writer, slug);

        return {
            files: [
                {
                    path: HydrogenExampleGenerator.replaceVariables(this.configuration.routeFilePath, definition.id),
                    language: this.configuration.typescript
                        ? CodeLanguage.TYPESCRIPT_XML
                        : CodeLanguage.JAVASCRIPT_XML,
                    code: writer.toString(),
                },
            ],
        };
    }

    private writeRoute(writer: CodeWriter, slug: string): void {
        const {typescript, era} = this.configuration;
        const isReactRouter = era === 'react-router';
        const name = HydrogenExampleGenerator.replaceVariables(this.configuration.routeComponentName, slug);

        writer.write("import {Slot} from '@croct/plug-hydrogen';");
        writer.write("import {fetchContent} from '@croct/plug-hydrogen/server';");
        writer.write(`import {useLoaderData} from '${isReactRouter ? 'react-router' : '@remix-run/react'}';`);

        if (typescript) {
            writer.write(
                isReactRouter
                    ? `import type {Route} from './+types/${slug}';`
                    : "import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';",
            );
        }

        writer.newLine();

        const argsType = typescript
            ? `: ${isReactRouter ? 'Route.LoaderArgs' : 'LoaderFunctionArgs'}`
            : '';

        writer.write(`export async function loader({context}${argsType}) {`)
            .indent()
            .write(`const {content} = await fetchContent('${slug}', {context});`)
            .newLine()
            .write('return {content};')
            .outdent()
            .write('}');

        writer.newLine();

        writer.write(`export default function ${name}() {`)
            .indent()
            .write(`const data = useLoaderData${typescript ? '<typeof loader>' : ''}();`)
            .newLine()
            .write('return (')
            .indent()
            .write(`<Slot id="${slug}" initial={data.content}>`)
            .indent()
            .write('{({content}) => <pre>{JSON.stringify(content, null, 2)}</pre>}')
            .outdent()
            .write('</Slot>')
            .outdent()
            .write(');')
            .outdent()
            .write('}');
    }

    private static replaceVariables(value: string, id: string): string {
        return value.replace(/%name%/g, CodeWriter.formatName(id, true))
            .replace(/%slug%/g, formatSlug(id));
    }
}
