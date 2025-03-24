import {ReactExampleGenerator, Configuration as ReactConfiguration, SlotFile} from './reactExampleGenerator';
import {SlotDefinition} from './slotExampleGenerator';
import {CodeWriter} from '@/application/project/code/generation/codeWritter';
import {CodeLanguage} from '@/application/project/code/generation/example';

export enum NextExampleRouter {
    PAGE = 'page',
    APP = 'app',
}

type NextExampleOptions = {
    router: NextExampleRouter,
};

export type Configuration = Omit<ReactConfiguration, 'contentVariable'> & NextExampleOptions;

export class PlugNextExampleGenerator extends ReactExampleGenerator {
    private readonly nextOptions: NextExampleOptions;

    public constructor({fileSystem, router, ...options}: Configuration) {
        super({
            fileSystem: fileSystem,
            contentVariable: router === NextExampleRouter.APP ? 'content' : 'props',
            ...options,
        });

        this.nextOptions = {
            router: router,
        };
    }

    protected writeSlotHeader(writer: CodeWriter, definition: SlotDefinition): void {
        switch (this.options.language) {
            case CodeLanguage.JAVASCRIPT_XML:
                if (this.nextOptions.router === NextExampleRouter.APP) {
                    writer.write('import {fetchContent} from \'@croct/plug-next/server\';');
                    writer.newLine();
                }

                break;

            case CodeLanguage.TYPESCRIPT_XML:
                writer.write('import type {ReactElement} from \'react\';');

                if (this.nextOptions.router === NextExampleRouter.APP) {
                    writer.write('import {fetchContent} from \'@croct/plug-next/server\';');
                }

                if (this.nextOptions.router === NextExampleRouter.PAGE) {
                    writer.write('import type {SlotContent} from \'@croct/plug-next\';');
                    writer.newLine();

                    const slotName = CodeWriter.formatName(definition.id, true);

                    writer
                        .write(`export type ${slotName}Props = SlotContent<'${definition.id}@${definition.version}'>;`);
                }

                writer.newLine();

                break;
        }
    }

    protected writeSlotFetch(writer: CodeWriter, definition: SlotDefinition): void {
        if (this.nextOptions.router === NextExampleRouter.APP) {
            const variable = this.options.contentVariable;

            writer
                .write(`const {${variable}} = await fetchContent('${definition.id}@${definition.version}');`)
                .newLine();
        }
    }

    protected writePageHeader(writer: CodeWriter, slot: SlotFile): void {
        if (this.nextOptions.router === NextExampleRouter.APP) {
            return super.writePageHeader(writer, slot);
        }

        const slotId = `${slot.definition.id}@${slot.definition.version}`;

        switch (this.options.language) {
            case CodeLanguage.JAVASCRIPT_XML:
                writer.write('import {fetchContent} from \'@croct/plug-next/server\';')
                    .write(`import ${slot.name} from '${slot.importPath}';`);

                writer.newLine()
                    .write('export async function getServerSideProps(context) {')
                    .indent()
                    .write('return {')
                    .indent()
                    .write(`props: await fetchContent('${slotId}', {`)
                    .indent()
                    .write('route: context,')
                    .outdent()
                    .write('}),')
                    .outdent()
                    .write('}')
                    .outdent()
                    .write('}');

                break;

            case CodeLanguage.TYPESCRIPT_XML:
                writer.write('import type {ReactElement} from \'react\';');
                writer.write('import type {GetServerSideProps} from \'next\';');
                writer.write('import {fetchContent} from \'@croct/plug-next/server\';');
                writer.write(`import ${slot.name}, {type ${slot.name}Props} from '${slot.importPath}';`);

                writer.newLine()
                    .write('type PageProps = {')
                    .indent()
                    .write(`content: ${slot.name}Props,`)
                    .outdent()
                    .write('};')
                    .newLine()
                    .write('export const getServerSideProps: ', false)
                    .write('GetServerSideProps<PageProps> = async context => ({')
                    .indent()
                    .write(`props: await fetchContent('${slotId}', {`)
                    .indent()
                    .write('route: context,')
                    .outdent()
                    .write('}),')
                    .outdent()
                    .write('});');

                break;
        }
    }

    protected writePageSignature(writer: CodeWriter, name: string): void {
        switch (this.nextOptions.router) {
            case NextExampleRouter.APP:
                super.writePageSignature(writer, name);

                break;

            case NextExampleRouter.PAGE: {
                writer.write(
                    this.options.language === CodeLanguage.TYPESCRIPT_XML
                        ? 'export default function Page({content}: PageProps): ReactElement {'
                        : 'export default function Page({content}) {',
                );

                break;
            }
        }
    }

    protected appendSlotParams(writer: CodeWriter, definition: SlotDefinition): void {
        if (this.nextOptions.router !== NextExampleRouter.PAGE) {
            return super.appendSlotParams(writer, definition);
        }

        const slotName = CodeWriter.formatName(definition.id, true);
        const variable = this.options.contentVariable;

        if (this.options.language === CodeLanguage.JAVASCRIPT_XML) {
            writer.append(`(${variable})`);

            return;
        }

        writer.append(`(${variable}: ${slotName}Props)`);
    }

    protected writeSlotRendering(writer: CodeWriter, name: string): void {
        switch (this.nextOptions.router) {
            case NextExampleRouter.APP:
                super.writeSlotRendering(writer, name);

                break;

            case NextExampleRouter.PAGE: {
                writer.write(`<${name} {...content} />`);

                break;
            }
        }
    }

    protected isSlotFetchAsync(): boolean {
        return this.nextOptions.router === NextExampleRouter.APP;
    }

    protected isSlotFetchBlocking(): boolean {
        return this.nextOptions.router === NextExampleRouter.APP;
    }

    protected hasSuspenseBoundary(): boolean {
        return false;
    }
}
