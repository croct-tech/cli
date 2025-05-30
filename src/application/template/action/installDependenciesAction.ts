import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {PackageManager} from '@/application/project/packageManager/packageManager';

export type InstallDependenciesOptions = Record<string, never>;

export type Configuration = {
    packageManager: PackageManager,
};

export class InstallDependenciesAction implements Action<InstallDependenciesOptions> {
    private readonly packageManager: PackageManager;

    public constructor({packageManager}: Configuration) {
        this.packageManager = packageManager;
    }

    public async execute(_: InstallDependenciesOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Installing dependencies');

        try {
            await this.packageManager.installDependencies();
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier?.stop();
        }
    }
}
