import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {PackageManager} from '@/application/project/packageManager/packageManager';

export type AddDependencyOptions = {
    dependencies: string[],
    development?: boolean,
};

export type Configuration = {
    packageManager: PackageManager,
};

export class AddDependencyAction implements Action<AddDependencyOptions> {
    private readonly packageManager: PackageManager;

    public constructor({packageManager}: Configuration) {
        this.packageManager = packageManager;
    }

    public async execute(options: AddDependencyOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Installing dependencies');

        try {
            await this.packageManager.addDependencies(options.dependencies, options.development === true);
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier?.stop();
        }
    }
}
