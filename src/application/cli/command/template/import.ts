import {JsonPrimitive} from '@croct/json';
import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {ActionRunner} from '@/application/cli/action/runner';
import {FileSystem} from '@/application/fileSystem/fileSystem';
import {Manifest, OptionMap} from '@/application/template/manifest';
import {ActionContext} from '@/application/cli/action/context';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {SdkResolver} from '@/application/project/sdk/sdk';
import {ApplicationPlatform} from '@/application/model/application';

export type ImportTemplateInput = {
    template: string,
    options: Record<string, JsonPrimitive>,
};

export type ImportTemplateConfig = {
    configurationManager: ConfigurationManager,
    sdkResolver: SdkResolver,
    fileSystem: FileSystem,
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
        const manifest = await this.loadManifest(template);

        return manifest.options ?? {};
    }

    public async execute(input: ImportTemplateInput): Promise<void> {
        const {actionRunner} = this.config;
        const manifest = await this.loadManifest(input.template);

        await actionRunner.run(manifest.actions, this.createContext(input.options));
    }

    private createContext(options: Record<string, JsonPrimitive>): ActionContext {
        const {io, configurationManager, sdkResolver} = this.config;

        const context = new ActionContext({
            input: io.input,
            output: io.output,
            variables: {
                'project.path.example': async () => (await configurationManager.resolve()).paths.examples,
                'project.path.component': async () => (await configurationManager.resolve()).paths.components,
                'project.platform': async (): Promise<string> => {
                    const sdk = await sdkResolver.resolve();

                    return ApplicationPlatform.getName(sdk.getPlatform())
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-');
                },
            },
        });

        for (const [key, value] of Object.entries(options)) {
            context.set(
                `input.${key}`,
                typeof value === 'string'
                    ? (): Promise<JsonPrimitive|JsonPrimitive[]> => context.resolve(value)
                    : value,
            );
        }

        return context;
    }

    private async loadManifest(template: string): Promise<Manifest> {
        const {fileSystem} = this.config;
        const content = await fileSystem.readFile(template);

        return JSON.parse(content) as Manifest;
    }
}
