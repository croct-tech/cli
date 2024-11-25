import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Installation, SdkResolver} from '@/application/project/sdk/sdk';
import {ProjectConfigurationManager} from '@/application/project/configuration';
import {Form} from '@/application/cli/form/form';
import {Slot} from '@/application/model/entities';
import {SlotOptions} from '@/application/cli/form/workspace/slotForm';
import {Version} from '@/application/project/version';

export type AddSlotInput = {
    slots?: string[],
    example?: boolean,
};

export type AddSlotConfig = {
    sdkResolver: SdkResolver,
    configurationManager: ProjectConfigurationManager,
    slotForm: Form<Slot[], SlotOptions>,
    io: {
        input: Input,
        output: Output,
    },
};

export class AddSlotCommand implements Command<AddSlotInput> {
    private readonly config: AddSlotConfig;

    public constructor(config: AddSlotConfig) {
        this.config = config;
    }

    public async execute(input: AddSlotInput): Promise<void> {
        const {sdkResolver, configurationManager, slotForm, io} = this.config;
        const {output} = io;

        const sdk = await sdkResolver.resolve();
        const configuration = await configurationManager.resolve();

        const slots = await slotForm.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            default: input.slots,
            selected: Object.keys(configuration.slots),
        });

        if (input.slots !== undefined && input.slots.length > 0 && slots.length !== input.slots.length) {
            const missingSlots = input.slots.filter(slug => !slots.some(slot => slot.slug === slug));

            output.alert(`Slots not found: ${missingSlots.join(', ')}.`);

            return output.exit();
        }

        if (slots.length === 0) {
            output.alert('No slots found or selected.');

            return;
        }

        const installation: Installation = {
            input: io.input,
            output: io.output,
            configuration: {
                ...configuration,
                slots: {
                    ...configuration.slots,
                    ...Object.fromEntries(slots.map(slot => [slot.slug, Version.of(slot.version.major)])),
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
}
