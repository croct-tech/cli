import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type AddDependencyOptions = {
    dependencies: string[],
    development?: boolean,
};

export type DependencyInstaller = (dependencies: string[], development: boolean) => Promise<void>;

export type Configuration = {
    installer: DependencyInstaller,
};

export class AddDependencyAction implements Action<AddDependencyOptions> {
    private readonly installer: DependencyInstaller;

    public constructor({installer}: Configuration) {
        this.installer = installer;
    }

    public async execute(options: AddDependencyOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Installing dependencies');

        try {
            await this.installer(options.dependencies, options.development === true);
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier?.stop();
        }
    }
}
