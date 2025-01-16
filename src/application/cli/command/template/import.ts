import {JsonPrimitive} from '@croct/json';
import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {ActionRunner} from '@/application/template/action/runner';
import {FileSystem} from '@/application/fs/fileSystem';
import {Template, OptionMap} from '@/application/template/template';
import {ActionContext, VariableValue} from '@/application/template/action/context';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {SdkResolver} from '@/application/project/sdk/sdk';
import {ApplicationPlatform} from '@/application/model/application';
import {CliError, CliErrorCode} from '@/application/cli/error';
import {Transport} from '@/application/template/transport/transport';

export type ImportTemplateInput = {
    template: string,
    options: Record<string, JsonPrimitive>,
};

export type LoadedTemplate = {
    url: URL,
    template: Template,
};

export type ImportTemplateConfig = {
    configurationManager: ConfigurationManager,
    sdkResolver: SdkResolver,
    fileSystem: FileSystem,
    transport: Transport<LoadedTemplate>,
    actionRunner: ActionRunner,
    io: {
        input?: Input,
        output: Output,
    },
};
export class ImportTemplateCommand implements Command<ImportTemplateInput> {
    private readonly config: ImportTemplateConfig;

    public constructor(config: ImportTemplateConfig) {
        this.config = config;
    }

    public async getOptions(template: string): Promise<OptionMap> {
        try {
            return (await this.loadTemplate(template)).template.options ?? {};
        } catch {
            // Postpone the error handling to the execute method
            return {};
        }
    }

    public async execute(input: ImportTemplateInput): Promise<void> {
        const {actionRunner} = this.config;
        const {url, template} = await this.loadTemplate(input.template);

        await actionRunner.run(template.actions, this.createContext(input.options, url));
    }

    private createContext(options: Record<string, JsonPrimitive>, baseUrl: URL): ActionContext {
        const {io, configurationManager, sdkResolver} = this.config;

        const context = new ActionContext({
            input: io.input,
            output: io.output,
            baseUrl: baseUrl,
            variables: Object.freeze({
                project: Object.freeze({
                    path: Object.freeze({
                        example: async () => (await configurationManager.resolve()).paths.examples,
                        component: async () => (await configurationManager.resolve()).paths.components,
                    }),
                    platform: async (): Promise<string> => {
                        const sdk = await sdkResolver.resolve();

                        return ApplicationPlatform.getName(sdk.getPlatform())
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-');
                    },
                }),
                input: Object.freeze(
                    Object.fromEntries(
                        Object.entries(options).map(
                            ([key, value]) => [
                                key.replace(/~/g, '~0').replace(/\//g, '~1'),
                                typeof value === 'string'
                                    ? (): Promise<VariableValue> => context.resolveValue(value)
                                    : value,
                            ],
                        ),
                    ),
                ),
                output: {},
            }),
        });

        return context;
    }

    private async loadTemplate(name: string): Promise<LoadedTemplate> {
        const {transport} = this.config;

        const url = await this.resolveUrl(name);

        let result: LoadedTemplate;

        try {
            result = await transport.fetch(url);
        } catch (error) {
            throw new CliError('Template not found.', {
                code: CliErrorCode.INVALID_INPUT,
                details: [
                    `Template: ${name}`,
                ],
                suggestions: [
                    'Check if the template path or URL is correct and try again.',
                ],
            });
        }

        const resolvedUrl = result.url;

        return {
            url: new URL(resolvedUrl.href.replace(/\/[^/]+$/, '/')),
            template: result.template,
        };
    }

    private async resolveUrl(name: string): Promise<URL> {
        const {fileSystem} = this.config;

        let path = name;

        if (URL.canParse(name)) {
            const url = new URL(name);

            if (url.protocol !== 'file:') {
                return url;
            }

            path = fileSystem.normalizeSeparators(url.pathname);
        }

        return new URL(`file://${await fileSystem.getRealPath(path)}`);
    }
}
