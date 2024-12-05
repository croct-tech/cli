import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {SdkResolver} from '@/application/project/sdk/sdk';
import {ResolvedConfiguration} from '@/application/project/configuration/configuration';
import {Form} from '@/application/cli/form/form';
import {Component} from '@/application/model/entities';
import {ComponentOptions} from '@/application/cli/form/workspace/componentForm';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';

export type RemoveComponentInput = {
    components?: string[],
};

export type RemoveComponentConfig = {
    sdkResolver: SdkResolver,
    configurationManager: ConfigurationManager,
    componentForm: Form<Component[], ComponentOptions>,
    io: {
        input?: Input,
        output: Output,
    },
};

export class RemoveComponentCommand implements Command<RemoveComponentInput> {
    private readonly config: RemoveComponentConfig;

    public constructor(config: RemoveComponentConfig) {
        this.config = config;
    }

    public async execute(input: RemoveComponentInput): Promise<void> {
        const {sdkResolver, configurationManager, componentForm, io} = this.config;
        const {output} = io;

        const sdk = await sdkResolver.resolve();
        const configuration = await configurationManager.resolve();

        const components = await componentForm.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            preselected: input.components,
            allowed: Object.keys(configuration.components),
        });

        if (components.length === 0) {
            return output.alert('No components to remove.');
        }

        const updatedConfiguration: ResolvedConfiguration = {
            ...configuration,
            components: Object.fromEntries(
                Object.entries(configuration.components)
                    .filter(([slug]) => !components.some(component => component.slug === slug)),
            ),
        };

        output.confirm('Configuration updated');

        await configurationManager.update(updatedConfiguration);

        await sdk.update({
            input: io.input,
            output: io.output,
            configuration: updatedConfiguration,
        });
    }
}
