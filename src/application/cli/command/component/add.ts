import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {SdkResolver} from '@/application/project/sdk/sdk';
import {
    ResolvedConfiguration,
    Configuration as ProjectConfiguration,
} from '@/application/project/configuration/configuration';
import {Form} from '@/application/cli/form/form';
import {Component} from '@/application/model/entities';
import {ComponentOptions} from '@/application/cli/form/workspace/componentForm';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {CliError, CliErrorCode} from '@/application/cli/error';

export type AddComponentInput = {
    components?: string[],
};

export type AddComponentConfig = {
    sdkResolver: SdkResolver,
    configurationManager: ConfigurationManager,
    componentForm: Form<Component[], ComponentOptions>,
    io: {
        input?: Input,
        output: Output,
    },
};

export class AddComponentCommand implements Command<AddComponentInput> {
    private readonly config: AddComponentConfig;

    public constructor(config: AddComponentConfig) {
        this.config = config;
    }

    public async execute(input: AddComponentInput): Promise<void> {
        const {sdkResolver, configurationManager, io} = this.config;
        const {output} = io;

        const sdk = await sdkResolver.resolve();
        const configuration = await configurationManager.resolve();
        const components = await this.getComponents(configuration, input);

        if (components.length === 0) {
            output.inform('No components to add');

            return;
        }

        const updatedConfiguration: ResolvedConfiguration = {
            ...configuration,
            components: {
                ...configuration.components,
                ...Object.fromEntries(
                    components.map(component => [component.slug, `${component.version.major}`]),
                ),
            },
        };

        output.confirm('Configuration updated');

        await configurationManager.update(updatedConfiguration);

        await sdk.update({
            input: io.input,
            output: io.output,
            configuration: updatedConfiguration,
        });
    }

    private async getComponents(configuration: ProjectConfiguration, input: AddComponentInput): Promise<Component[]> {
        const form = this.config.componentForm;

        const components = await form.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            preselected: input.components,
            selected: Object.keys(configuration.components),
        });

        if (
            input.components !== undefined
            && input.components.length > 0
            && components.length !== input.components.length
        ) {
            const missingComponents = input.components.filter(
                slug => !components.some(component => component.slug === slug),
            );

            throw new CliError(`Non-existing components: ${missingComponents.join(', ')}`, {
                code: CliErrorCode.INVALID_INPUT,
                suggestions: ['Run `component add` without arguments to see available components'],
            });
        }

        return components;
    }
}
