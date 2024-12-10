import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Installation, SdkResolver} from '@/application/project/sdk/sdk';
import {Form} from '@/application/cli/form/form';
import {Slot} from '@/application/model/entities';
import {SlotOptions} from '@/application/cli/form/workspace/slotForm';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {CliError, CliErrorCode} from '@/application/cli/error';
import {Configuration as ProjectConfiguration} from '@/application/project/configuration/configuration';
import {Version} from '@/application/project/version';

export type AddSlotInput = {
    slots?: string[],
    example?: boolean,
};

export type AddSlotConfig = {
    sdkResolver: SdkResolver,
    configurationManager: ConfigurationManager,
    slotForm: Form<Slot[], SlotOptions>,
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
        const {sdkResolver, configurationManager, io} = this.config;
        const {output} = io;

        const sdk = await sdkResolver.resolve();
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
                    ...Object.fromEntries(slots.map(([slot, version]) => [slot, `${version}`])),
                },
            },
        };

        await configurationManager.update(installation.configuration);

        output.confirm('Configuration updated');

        await sdk.update(installation);

        if (input.example === true) {
            const notifier = output.notify('Generating example');

            await Promise.all(slots.map(([slot]) => sdk.generateSlotExample(slot, installation)));

            notifier.confirm('Example generated');
        }
    }

    private async getSlots(configuration: ProjectConfiguration, input: AddSlotInput): Promise<VersionedSlot[]> {
        const {slotForm} = this.config;

        const versionedSlots = input.slots === undefined
            ? undefined
            : Object.fromEntries(
                input.slots?.map<[string, Version|undefined]>(versionedId => {
                    const [slug, version] = versionedId.split('@', 2);

                    if (version === undefined) {
                        return [slug, undefined];
                    }

                    if (!Version.isValid(version)) {
                        throw new CliError(`Invalid version \`${version}\` for slot \`${slug}\``, {
                            code: CliErrorCode.INVALID_INPUT,
                        });
                    }

                    return [slug, Version.parse(version)];
                }),
            );

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

            throw new CliError(`Non-existing slots: \`${missingSlots.join('`, `')}\``, {
                code: CliErrorCode.INVALID_INPUT,
                suggestions: ['Run `slot add` without arguments to see available slots'],
            });
        }

        return slots.map(slot => [slot, versionedSlots?.[slot.slug] ?? Version.of(slot.version.major)]);
    }
}
