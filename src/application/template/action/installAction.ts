import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {PackageManager} from '@/application/project/packageManager/packageManager';

export type InstallOptions = Record<string, never>;

export type Configuration = {
    packageManager: PackageManager,
};

export class InstallAction implements Action<InstallOptions> {
    private readonly packageManager: PackageManager;

    public constructor({packageManager}: Configuration) {
        this.packageManager = packageManager;
    }

    public async execute(_: InstallOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Installing dependencies');

        try {
            await this.packageManager.installDependencies({
                logger: {
                    log: log => notifier?.update(
                        'Installing dependencies',
                        log.message.split(/\n+/)[0],
                    ),
                },
            });
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier?.stop();
        }
    }
}
