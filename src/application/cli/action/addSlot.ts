import {Action, ActionError} from '@/application/cli/action/action';
import {ActionContext} from '@/application/cli/action/context';

export type AddSlotOptions = {
    slots: string|string[],
    example?: string|boolean,
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
        const [slots, example] = await Promise.all([
            typeof options.slots === 'string'
                ? context.resolveStringList(options.slots)
                : Promise.all(options.slots.map(slot => context.resolveString(slot))),
            typeof options.example === 'string'
                ? context.resolveBoolean(options.example)
                : options.example === true,
        ]);

        try {
            await installer(slots, example);
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}

declare module '@/application/cli/action/action' {
    export interface ActionOptionsMap {
        'add-slot': AddSlotOptions;
    }
}
