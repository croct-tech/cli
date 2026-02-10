import type {Command} from '@/application/cli/command/command';
import type {Output} from '@/application/cli/io/output';
import type {Input} from '@/application/cli/io/input';
import type {FileSystem} from '@/application/fs/fileSystem';
import type {OptionMap, Template} from '@/application/template/template';
import type {ResourceProvider} from '@/application/provider/resource/resourceProvider';
import type {VariableMap} from '@/application/template/evaluation';
import type {Action} from '@/application/template/action/action';
import {ActionError} from '@/application/template/action/action';
import type {ImportOptions} from '@/application/template/action/importAction';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason} from '@/application/error';

export type UseTemplateInput = {
    template: string,
    options: VariableMap,
};

export type UseTemplateConfig = {
    fileSystem: FileSystem,
    templateProvider: ResourceProvider<Template>,
    action: Action<ImportOptions>,
    io: {
        input?: Input,
        output: Output,
    },
};

export class UseTemplateCommand implements Command<UseTemplateInput> {
    private readonly config: UseTemplateConfig;

    public constructor(config: UseTemplateConfig) {
        this.config = config;
    }

    public async getOptions(template: string): Promise<OptionMap> {
        const {templateProvider} = this.config;

        return (await templateProvider.get(await this.resolveUrl(template))).value.options ?? {};
    }

    public async execute(input: UseTemplateInput): Promise<void> {
        const {action, io} = this.config;
        const {template, options} = input;
        const url = await this.resolveUrl(template);

        return action.execute(
            {
                template: url.toString(),
                options: options,
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
            // Ensure compatibility with URLs like npm://@scope/package
            const url = new URL(name.replace(/(?<=^[a-z]+:\/*)([^/.:]+)/i, match => match.replace(/@/g, '%40')));

            if (url.protocol !== 'file:') {
                return url;
            }

            path = fileSystem.normalizeSeparators(url.pathname);
        }

        try {
            return new URL(`file://${await fileSystem.getRealPath(path)}`);
        } catch (error) {
            throw new ActionError(`Template file not found at \`${path}\`.`, {
                reason: ErrorReason.INVALID_INPUT,
                cause: error,
                suggestions: ['Check the file path and try again.'],
            });
        }
    }
}
