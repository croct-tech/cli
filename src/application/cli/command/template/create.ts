import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Form} from '@/application/cli/form/form';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {TemplateOptions, TemplateResources} from '@/application/cli/form/workspace/templateForm';

export type CreateTemplateInput = {
};

export type CreateTemplateConfig = {
    configurationManager: ConfigurationManager,
    templateForm: Form<TemplateResources, TemplateOptions>,
    io: {
        input?: Input,
        output: Output,
    },
};

export class CreateTemplateCommand implements Command<CreateTemplateInput> {
    private readonly config: CreateTemplateConfig;

    public constructor(config: CreateTemplateConfig) {
        this.config = config;
    }

    public async execute(input: CreateTemplateInput): Promise<void> {
        const {configurationManager, templateForm: form} = this.config;

        const configuration = await configurationManager.resolve();

        const resources = await form.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
        });

        console.log(JSON.stringify(resources, null, 2));
    }
}
