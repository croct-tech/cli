import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Installation, Sdk} from '@/application/project/sdk/sdk';
import {Form} from '@/application/cli/form/form';
import {SlotOptions} from '@/application/cli/form/workspace/slotForm';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {Configuration as ProjectConfiguration} from '@/application/project/configuration/configuration';
import {Version} from '@/application/model/version';
import {WorkspaceApi} from '@/application/api/workspace';
import {Slot} from '@/application/model/slot';
import {HelpfulError, ErrorReason} from '@/application/error';

export type AddSlotInput = {
    slots?: string[],
    example?: boolean,
};

export type AddSlotConfig = {
    sdk: Sdk,
    configurationManager: ConfigurationManager,
    slotForm: Form<Slot[], SlotOptions>,
    workspaceApi: WorkspaceApi,
    io: {
        input?: Input,
        output: Output,
    },
};

type VersionedSlot = [Slot, Version];

export class AddSlotCommand implements Command<AddSlotInput> {
    private readonly config: AddSlotConfig;

    public constructor(config: AddSlotConfig) {
        this.config = config;
    }

    public async execute(input: AddSlotInput): Promise<void> {
        const {sdk, configurationManager, io} = this.config;
        const {output} = io;

        const configuration = await configurationManager.resolve();
        const slots = await this.getSlots(configuration, input);

        if (slots.length === 0) {
            output.inform('No slots to add');

            return;
        }

        const installation: Installation = {
            input: io.input,
            output: io.output,
            configuration: {
                ...configuration,
                slots: {
                    ...configuration.slots,
                    ...Object.fromEntries(slots.map(([slot, version]) => [slot.slug, version.toString()])),
                },
            },
        };

        await configurationManager.update(installation.configuration);

        output.confirm('Configuration updated');

        await sdk.update(installation);

        if (input.example === true) {
            const notifier = output.notify('Generating example');

            try {
                await Promise.all(slots.map(([slot]) => sdk.generateSlotExample(slot, installation)));
            } catch (error) {
                notifier.stop();

                throw error;
            }

            notifier.confirm('Example generated');
        }
    }

    private async getSlots(configuration: ProjectConfiguration, input: AddSlotInput): Promise<VersionedSlot[]> {
        const {slotForm, workspaceApi} = this.config;

        const versionedSlots = input.slots === undefined
            ? undefined
            : AddSlotCommand.getVersionMap(input.slots, configuration.slots);

        const slots = await slotForm.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            preselected: versionedSlots === undefined
                ? undefined
                : Object.keys(versionedSlots),
            selected: Object.keys(configuration.slots),
        });

        if (input.slots !== undefined && input.slots.length > 0 && slots.length !== input.slots.length) {
            const missingSlots = input.slots.filter(slug => !slots.some(slot => slot.slug === slug));

            throw new HelpfulError(`Non-existing slots: \`${missingSlots.join('`, `')}\``, {
                reason: ErrorReason.INVALID_INPUT,
                suggestions: ['Run `slot add` without arguments to see available slots'],
            });
        }

        return Promise.all(slots.map(async slot => {
            const version = versionedSlots?.[slot.slug];

            if (version === undefined || version.getMaxVersion() === slot.version.major) {
                return [slot, version ?? Version.of(slot.version.major)];
            }

            if (version.getMinVersion() > slot.version.major) {
                throw new HelpfulError(
                    `No matching version for slot \`${slot.slug}\`.`,
                    {
                        reason: ErrorReason.INVALID_INPUT,
                        details: [
                            `Requested version: ${version.toString()}`,
                            `Current version: ${slot.version.major}`,
                        ],
                        suggestions: ['Omit version specifier to use the latest version'],
                    },
                );
            }

            if (input.example !== true) {
                return [slot, version];
            }

            // Get the specified version to generate correct example
            const slotVersion = await workspaceApi.getSlot({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
                slotSlug: slot.slug,
                majorVersion: Math.min(slot.version.major, version.getMinVersion()),
            });

            return [slotVersion ?? slot, version];
        }));
    }

    private static getVersionMap(
        specifiers: string[],
        slots: ProjectConfiguration['slots'],
    ): Record<string, Version|undefined> {
        return Object.fromEntries(
            specifiers.map(versionedId => {
                const [slug, specifier] = versionedId.split('@', 2);

                if (specifier === undefined) {
                    return [slug, undefined];
                }

                if (!Version.isValid(specifier)) {
                    throw new HelpfulError(
                        `Invalid version specifier \`${specifier}\` for slot \`${slug}\`.`,
                        {
                            reason: ErrorReason.INVALID_INPUT,
                            suggestions: [
                                'Version must be exact (i.e. `1`), range (i.e. `1 - 2`), or set (i.e. `1 || 2`).',
                            ],
                        },
                    );
                }

                let version = Version.parse(specifier);

                if (version.getCardinality() > 5) {
                    throw new HelpfulError(
                        `The number of versions specified for slot \`${slug}\` exceeds 5 major versions.`,
                        {
                            reason: ErrorReason.INVALID_INPUT,
                            suggestions: [
                                'Narrow down the number of versions to 5 or less.',
                            ],
                        },
                    );
                }

                if (slots[slug] !== undefined) {
                    version = Version.parse(slots[slug]).with(version);

                    if (version.getCardinality() > 5) {
                        throw new HelpfulError(
                            `The cumulative number of versions for slot \`${slug}\` `
                            + 'cannot exceed 5 major versions.',
                            {
                                reason: ErrorReason.INVALID_INPUT,
                                suggestions: [
                                    'Narrow down the number of versions to 5 or less.',
                                ],
                            },
                        );
                    }
                }

                return [slug, version];
            }),
        );
    }
}
