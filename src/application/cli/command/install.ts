import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {SdkResolver} from '@/application/project/sdk/sdk';
import {Form} from '@/application/cli/form/form';
import {Slot} from '@/application/model/entities';
import {SlotOptions} from '@/application/cli/form/workspace/slotForm';
import {Version} from '@/application/project/version';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {CliError, CliErrorCode} from '@/application/cli/error';

export type InstallInput = Record<string, never>;

export type InstallConfig = {
    sdkResolver: SdkResolver,
    configurationManager: ConfigurationManager,
    slotForm: Form<Slot[], SlotOptions>,
    io: {
        input?: Input,
        output: Output,
    },
};

export class InstallCommand implements Command<InstallInput> {
    private readonly config: InstallConfig;

    public constructor(config: InstallConfig) {
        this.config = config;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Avoid narrowing down the type of the input
    public async execute(_input: InstallInput): Promise<void> {
        const {sdkResolver, configurationManager, slotForm, io} = this.config;
        const sdk = await sdkResolver.resolve();
        const configuration = await configurationManager.resolve();
        const listedSlots = Object.keys(configuration.slots);
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

        await sdk.update({
            input: io.input,
            output: io.output,
            configuration: {
                ...configuration,
                slots: {
                    ...configuration.slots,
                    ...Object.fromEntries(slots.map(slot => [slot.slug, Version.of(slot.version.major)])),
                },
            },
        });
    }
}
