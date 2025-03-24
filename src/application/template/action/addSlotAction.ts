import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type AddSlotOptions = {
    slots: string[],
    example?: boolean,
};

export type SlotInstaller = (slots: string[], example: boolean) => Promise<void>;

export type Configuration = {
    installer: SlotInstaller,
};

export class AddSlotAction implements Action<AddSlotOptions> {
    private readonly installer: SlotInstaller;

    public constructor({installer}: Configuration) {
        this.installer = installer;
    }

    public async execute(options: AddSlotOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Installing slots');

        try {
            await this.installer(options.slots, options.example === true);
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier?.stop();
        }
    }
}
