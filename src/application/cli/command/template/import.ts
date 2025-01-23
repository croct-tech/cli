import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {FileSystem} from '@/application/fs/fileSystem';
import {OptionMap, Template} from '@/application/template/template';
import {ResourceProvider} from '@/application/provider/resourceProvider';
import {VariableMap} from '@/application/template/evaluation';
import {Action} from '@/application/template/action/action';
import {ImportOptions} from '@/application/template/action/importAction';
import {ActionContext} from '@/application/template/action/context';

export type ImportTemplateInput = {
    template: string,
    options: VariableMap,
};

export type ImportTemplateConfig = {
    fileSystem: FileSystem,
    templateProvider: ResourceProvider<Template>,
    action: Action<ImportOptions>,
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
        const {templateProvider} = this.config;

        try {
            return (await templateProvider.get(await this.resolveUrl(template))).options ?? {};
        } catch {
            // Postpone the error handling to the execute method
            return {};
        }
    }

    public async execute(input: ImportTemplateInput): Promise<void> {
        const {action, io} = this.config;
        const {template, options} = input;
        const url = await this.resolveUrl(template);

        return action.execute(
            {
                template: url.toString(),
                input: options,
            },
            new ActionContext({
                input: io.input,
                output: io.output,
                baseUrl: url,
            }),
        );
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
