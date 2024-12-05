import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Installation, SdkResolver} from '@/application/project/sdk/sdk';
import {Form} from '@/application/cli/form/form';
import {Slot} from '@/application/model/entities';
import {SlotOptions} from '@/application/cli/form/workspace/slotForm';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';

export type RemoveSlotInput = {
    slots?: string[],
};

export type RemoveSlotConfig = {
    sdkResolver: SdkResolver,
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
        const {sdkResolver, configurationManager, slotForm, io} = this.config;
        const {output} = io;

        const sdk = await sdkResolver.resolve();
        const configuration = await configurationManager.resolve();

        const slots = await slotForm.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            allowed: Object.keys(configuration.slots),
            preselected: input.slots,
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
                        .filter(([slug]) => !slots.some(slot => slot.slug === slug)),
                ),
            },
        };

        await configurationManager.update(installation.configuration);

        output.confirm('Configuration updated');

        await sdk.update(installation);
    }
}
