import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Installation, Sdk} from '@/application/project/sdk/sdk';
import {Form} from '@/application/cli/form/form';
import {SlotOptions} from '@/application/cli/form/workspace/slotForm';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import {Version} from '@/application/model/version';
import {Slot} from '@/application/model/slot';

export type RemoveSlotInput = {
    slots?: string[],
};

export type RemoveSlotConfig = {
    sdk: Sdk,
    configurationManager: ConfigurationManager,
    slotForm: Form<Slot[], SlotOptions>,
    io: {
        input?: Input,
        output: Output,
    },
};

export class RemoveSlotCommand implements Command<RemoveSlotInput> {
    private readonly config: RemoveSlotConfig;

    public constructor(config: RemoveSlotConfig) {
        this.config = config;
    }

    public async execute(input: RemoveSlotInput): Promise<void> {
        const {sdk, configurationManager, slotForm, io} = this.config;
        const {output} = io;

        const configuration = await configurationManager.load();

        const versionedSlots = input.slots === undefined
            ? undefined
            : RemoveSlotCommand.getVersionMap(input.slots, configuration.slots);

        const slots = await slotForm.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            allowed: Object.keys(configuration.slots),
            preselected: versionedSlots === undefined
                ? undefined
                : Object.keys(versionedSlots),
        });

        if (slots.length === 0) {
            return output.inform('No slots to remove.');
        }

        const installation: Installation = {
            input: io.input,
            output: io.output,
            configuration: {
                ...configuration,
                slots: Object.fromEntries(
                    Object.entries(configuration.slots)
                        .flatMap(([slug, version]) => {
                            if (versionedSlots?.[slug] !== undefined) {
                                if (versionedSlots[slug] === null) {
                                    return [];
                                }

                                return [[slug, versionedSlots[slug].toString()]];
                            }

                            if (slots.some(slot => slot.slug === slug)) {
                                return [];
                            }

                            return [[slug, version.toString()]];
                        }),
                ),
            },
        };

        await configurationManager.update(installation.configuration);

        output.confirm('Configuration updated');

        await sdk.update(installation);
    }

    private static getVersionMap(
        specifiers: string[],
        slots: ProjectConfiguration['slots'],
    ): Record<string, Version|null> {
        return Object.fromEntries(
            specifiers.map(versionedId => {
                const [slug, specifier] = versionedId.split('@', 2);

                if (slots[slug] === undefined || specifier === undefined) {
                    return [slug, null];
                }

                const currentVersion = Version.parse(slots[slug]);

                if (!Version.isValid(specifier)) {
                    return [slug, currentVersion];
                }

                const specifiedVersion = Version.parse(specifier);

                if (!currentVersion.intersects(specifiedVersion)) {
                    return [slug, currentVersion];
                }

                if (!specifiedVersion.contains(currentVersion)) {
                    return [slug, currentVersion.without(specifiedVersion)];
                }

                return [slug, null];
            }),
        );
    }
}
