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
            output.inform('No slots selected');

            return;
        }

        const installation: Installation = {
            input: io.input,
            output: io.output,
            configuration: {
                ...configuration,
                slots: {
                    ...configuration.slots,
                    ...Object.fromEntries(slots.map(slot => [slot.slug, `${slot.version.major}`])),
                },
            },
        };

        await configurationManager.update(installation.configuration);

        output.confirm('Configuration updated');

        await sdk.update(installation);

        if (input.example === true) {
            const notifier = output.notify('Generating example');

            await Promise.all(slots.map(slot => sdk.generateSlotExample(slot, installation)));

            notifier.confirm('Example generated');
        }
    }

    private async getSlots(configuration: ProjectConfiguration, input: AddSlotInput): Promise<Slot[]> {
        const {slotForm} = this.config;

        const slots = await slotForm.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            preselected: input.slots,
            selected: Object.keys(configuration.slots),
        });

        if (input.slots !== undefined && input.slots.length > 0 && slots.length !== input.slots.length) {
            const missingSlots = input.slots.filter(slug => !slots.some(slot => slot.slug === slug));

            throw new CliError(`Slots not found: \`${missingSlots.join('`, `')}\`.`, {
                code: CliErrorCode.PRECONDITION,
                suggestions: ['Run `remove slot` to remove a slot from your configuration.'],
            });
        }

        return slots;
    }
}
