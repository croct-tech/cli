import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Form} from '@/application/cli/form/form';
import {SlotOptions} from '@/application/cli/form/workspace/slotForm';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import {ComponentOptions} from '@/application/cli/form/workspace/componentForm';
import {Version} from '@/application/model/version';
import {Slot} from '@/application/model/slot';
import {Component} from '@/application/model/component';
import {HelpfulError, ErrorReason} from '@/application/error';
import {Installation, Sdk} from '@/application/project/sdk/sdk';

export type UpgradeInput = {
    slots?: string[],
    components?: string[],
};

export type UpgradeConfig = {
    sdk: Sdk,
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
        const {sdk, configurationManager, io} = this.config;
        const configuration = await configurationManager.load();

        const slots = await this.selectSlots(configuration, input.slots);
        const components = await this.selectComponents(configuration, input.components);

        const installation: Installation = {
            input: io.input,
            output: io.output,
            configuration: {
                ...configuration,
                slots: {
                    ...configuration.slots,
                    ...Object.fromEntries(slots.map(
                        slot => [
                            slot.slug,
                            UpgradeCommand.resolveVersion(
                                slot.version.major,
                                configuration.slots[slot.slug],
                            ),
                        ],
                    )),
                },
                components: {
                    ...configuration.components,
                    ...Object.fromEntries(
                        components.map(
                            component => [
                                component.slug,
                                UpgradeCommand.resolveVersion(
                                    component.version.major,
                                    configuration.components[component.slug],
                                ),
                            ],
                        ),
                    ),
                },
            },
        };

        await configurationManager.update(installation.configuration);

        await sdk.update(installation, {clean: true});
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

            throw new HelpfulError(`Components not found: \`${missingComponents.join('`, `')}\`.`, {
                reason: ErrorReason.PRECONDITION,
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

            throw new HelpfulError(`Slots not found: \`${missingSlots.join('`, `')}\`.`, {
                reason: ErrorReason.PRECONDITION,
                suggestions: ['Run `remove slot` to remove a slot from your configuration.'],
            });
        }

        return slots;
    }

    private static resolveVersion(latestVersion: number, currentVersion?: string): string {
        const latest = Version.of(latestVersion);

        if (currentVersion === undefined) {
            return latest.toString();
        }

        const current = Version.parse(currentVersion);

        if (current.isExact()) {
            return latest.toString();
        }

        if (current.isRange()) {
            if (current.getMaxVersion() >= latest.getMaxVersion()) {
                return currentVersion;
            }

            return Version.between(current.getMinVersion(), latest.getMaxVersion()).toString();
        }

        return Version.either(...current.getVersions(), ...latest.getVersions()).toString();
    }
}
