import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type AddSlotOptions = {
    slots: string|string[],
    example?: boolean,
};

export type SlotInstaller = (slots: string[], example: boolean) => Promise<void>;

export type Configuration = {
    installer: SlotInstaller,
};

export class AddSlot implements Action<AddSlotOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: AddSlotOptions, context: ActionContext): Promise<void> {
        const {installer} = this.config;
        const slots = await (typeof options.slots === 'string'
            ? context.resolveStringList(options.slots)
            : Promise.all(options.slots.map(slot => context.resolveString(slot))));

        try {
            await installer(slots, options.example === true);
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}

declare module '@/application/template/action/action' {
    export interface ActionOptionsMap {
        'add-slot': AddSlotOptions;
    }
}
