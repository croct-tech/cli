import type {SlotDefinition, SlotExampleGenerator} from './slotExampleGenerator';
import {ReactExampleGenerator} from './reactExampleGenerator';
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
export type HydrogenFramework = 'react-router' | 'remix';

export type Configuration = {
    typescript: boolean,
    framework: HydrogenFramework,
    routeFilePath: string,
    routeComponentName: string,
    indentationSize?: number,
};

/**
 * Generates a Hydrogen route that renders a slot.
 */
export class HydrogenExampleGenerator implements SlotExampleGenerator {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public generate(definition: SlotDefinition): CodeExample {
        const {
            typescript,
            framework,
            routeFilePath,
            routeComponentName,
            indentationSize,
        } = this.configuration;

        const slug = formatSlug(definition.id);
        const isReactRouter = framework === 'react-router';
        const name = HydrogenExampleGenerator.replaceVariables(routeComponentName, definition.id);
        const writer = new CodeWriter(indentationSize);

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
            .write(`const {content} = await fetchContent('${slug}', {scope: context});`)
            .newLine()
            .write('return {content};')
            .outdent()
            .write('}');

        writer.newLine();

        writer.write(`export default function ${name}() {`)
            .indent()
            .write(`const {content} = useLoaderData${typescript ? '<typeof loader>' : ''}();`)
            .newLine()
            .write('return (')
            .indent();

        ReactExampleGenerator.renderComponentSnippet(writer, definition.definition, 'content');

        writer
            .outdent()
            .write(');')
            .outdent()
            .write('}');

        return {
            files: [
                {
                    path: HydrogenExampleGenerator.replaceVariables(routeFilePath, definition.id),
                    language: typescript ? CodeLanguage.TYPESCRIPT_XML : CodeLanguage.JAVASCRIPT_XML,
                    code: writer.toString(),
                },
            ],
        };
    }

    private static replaceVariables(value: string, id: string): string {
        return value.replace(/%name%/g, CodeWriter.formatName(id, true))
            .replace(/%slug%/g, formatSlug(id));
    }
}
