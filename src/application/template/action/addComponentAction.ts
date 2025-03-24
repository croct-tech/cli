import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type AddComponentOptions = {
    components: string[],
};

export type ComponentInstaller = (components: string[]) => Promise<void>;

export type Configuration = {
    installer: ComponentInstaller,
};

export class AddComponentAction implements Action<AddComponentOptions> {
    private readonly installer: ComponentInstaller;

    public constructor({installer}: Configuration) {
        this.installer = installer;
    }

    public async execute(options: AddComponentOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Installing components');

        try {
            await this.installer(options.components);
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier?.stop();
        }
    }
}
