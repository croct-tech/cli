import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {SdkResolver} from '@/application/project/sdk/sdk';
import {Form} from '@/application/cli/form/form';
import {Component, Slot} from '@/application/model/entities';
import {SlotOptions} from '@/application/cli/form/workspace/slotForm';
import {Version} from '@/application/project/version';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {CliError, CliErrorCode} from '@/application/cli/error';
import {
    Configuration as ProjectConfiguration,
    ResolvedConfiguration,
} from '@/application/project/configuration/configuration';
import {ComponentOptions} from '@/application/cli/form/workspace/componentForm';

export type UpgradeInput = {
    slots?: string[],
    components?: string[],
};

export type UpgradeConfig = {
    sdkResolver: SdkResolver,
    configurationManager: ConfigurationManager,
    form: {
        slotForm: Form<Slot[], SlotOptions>,
        componentForm: Form<Component[], ComponentOptions>,
    },
    io: {
        input?: Input,
        output: Output,
    },
};

export class UpgradeCommand implements Command<UpgradeInput> {
    private readonly config: UpgradeConfig;

    public constructor(config: UpgradeConfig) {
        this.config = config;
    }

    public async execute(input: UpgradeInput): Promise<void> {
        const {sdkResolver, configurationManager, io} = this.config;
        const sdk = await sdkResolver.resolve();
        const configuration = await configurationManager.resolve();

        const slots = await this.selectSlots(configuration, input.slots);
        const components = await this.selectComponents(configuration, input.components);

        const updatedConfiguration: ResolvedConfiguration = {
            ...configuration,
            slots: {
                ...configuration.slots,
                ...Object.fromEntries(slots.map(slot => [slot.slug, Version.of(slot.version.major)])),
            },
            components: {
                ...configuration.components,
                ...Object.fromEntries(
                    components.map(component => [component.slug, Version.of(component.version.major)]),
                ),
            },
        };

        await configurationManager.update(updatedConfiguration);

        await sdk.update({
            input: io.input,
            output: io.output,
            configuration: updatedConfiguration,
        });
    }

    private async selectComponents(configuration: ProjectConfiguration, selected?: string[]): Promise<Component[]> {
        const {form: {componentForm}} = this.config;

        const listedComponents = selected === undefined
            ? Object.keys(configuration.components)
            : selected;

        const components = listedComponents.length === 0
            ? []
            : await componentForm.handle({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
                preselected: listedComponents,
            });

        if (listedComponents.length > 0 && components.length !== listedComponents.length) {
            const missingComponents = listedComponents.filter(
                slug => !components.some(component => component.slug === slug),
            );

            throw new CliError(`Components not found: \`${missingComponents.join('`, `')}\`.`, {
                code: CliErrorCode.PRECONDITION,
                suggestions: ['Run `remove component` to remove a component from your configuration.'],
            });
        }

        return components;
    }

    private async selectSlots(configuration: ProjectConfiguration, selected?: string[]): Promise<Slot[]> {
        const {form: {slotForm}} = this.config;

        const listedSlots = selected === undefined
            ? Object.keys(configuration.slots)
            : selected;

        const slots = listedSlots.length === 0
            ? []
            : await slotForm.handle({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
                preselected: listedSlots,
            });

        if (listedSlots.length > 0 && slots.length !== listedSlots.length) {
            const missingSlots = listedSlots.filter(slug => !slots.some(slot => slot.slug === slug));

            throw new CliError(`Slots not found: \`${missingSlots.join('`, `')}\`.`, {
                code: CliErrorCode.PRECONDITION,
                suggestions: ['Run `remove slot` to remove a slot from your configuration.'],
            });
        }

        return slots;
    }
}
