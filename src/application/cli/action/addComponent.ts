import {Action, ActionError} from '@/application/cli/action/action';
import {ActionContext} from '@/application/cli/action/context';

export type AddComponentOptions = {
    components: string|string[],
};

export type ComponentInstaller = (components: string[]) => Promise<void>;

export type Configuration = {
    installer: ComponentInstaller,
};

export class AddComponent implements Action<AddComponentOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: AddComponentOptions, context: ActionContext): Promise<void> {
        const {installer} = this.config;
        const components = typeof options.components === 'string'
            ? await context.resolveStringList(options.components)
            : await Promise.all(options.components.map(component => context.resolveString(component)));

        try {
            await installer(components);
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}

declare module '@/application/cli/action/action' {
    export interface ActionOptionsMap {
        'add-component': AddComponentOptions;
    }
}
