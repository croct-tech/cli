import {Action, ActionError} from '@/application/template/action/action';

export type AddComponentOptions = {
    components: string[],
};

export type ComponentInstaller = (components: string[]) => Promise<void>;

export type Configuration = {
    installer: ComponentInstaller,
};

export class AddComponentAction implements Action<AddComponentOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: AddComponentOptions): Promise<void> {
        const {installer} = this.config;

        try {
            await installer(options.components);
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
