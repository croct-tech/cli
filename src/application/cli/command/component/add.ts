import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {SdkResolver} from '@/application/project/sdk/sdk';
import {ProjectConfigurationManager, ResolvedProjectConfiguration} from '@/application/project/configuration';
import {Form} from '@/application/cli/form/form';
import {Component} from '@/application/model/entities';
import {Version} from '@/application/project/version';
import {ComponentOptions} from '@/application/cli/form/workspace/componentForm';

export type AddComponentInput = {
    components?: string[],
};

export type AddComponentConfig = {
    sdkResolver: SdkResolver,
    configurationManager: ProjectConfigurationManager,
    componentForm: Form<Component[], ComponentOptions>,
    io: {
        input: Input,
        output: Output,
    },
};

export class AddComponentCommand implements Command<AddComponentInput> {
    private readonly config: AddComponentConfig;

    public constructor(config: AddComponentConfig) {
        this.config = config;
    }

    public async execute(input: AddComponentInput): Promise<void> {
        const {sdkResolver, configurationManager, componentForm, io} = this.config;
        const {output} = io;

        const sdk = await sdkResolver.resolve();
        const configuration = await configurationManager.resolve();

        const components = await componentForm.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            default: input.components,
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

            output.alert(`Components not found: ${missingComponents.join(', ')}.`);

            return output.exit();
        }

        if (components.length === 0) {
            output.alert('No components found or selected.');

            return;
        }

        const updatedConfiguration: ResolvedProjectConfiguration = {
            ...configuration,
            components: {
                ...configuration.components,
                ...Object.fromEntries(
                    components.map(component => [component.slug, Version.of(component.version.major)]),
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
}
