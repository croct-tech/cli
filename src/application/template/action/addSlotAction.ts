import {Action, ActionError} from '@/application/template/action/action';

export type AddSlotOptions = {
    slots: string[],
    example?: boolean,
};

export type SlotInstaller = (slots: string[], example: boolean) => Promise<void>;

export type Configuration = {
    installer: SlotInstaller,
};

export class AddSlotAction implements Action<AddSlotOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: AddSlotOptions): Promise<void> {
        const {installer} = this.config;

        try {
            await installer(options.slots, options.example === true);
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
