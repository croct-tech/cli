import {Installation, Sdk} from '@/application/project/sdk/sdk';
import {ProjectManager} from '@/application/project/projectManager';
import {ApplicationPlatform} from '@/application/model/entities';
import {ProjectConfiguration} from '@/application/project/configuration';
import {Task} from '@/application/cli/io/output';

export type InstallationPlan = {
    tasks: Task[],
    configuration: ProjectConfiguration,
};

export abstract class JavaScriptSdk implements Sdk {
    protected projectManager: ProjectManager;

    public constructor(projectManager: ProjectManager) {
        this.projectManager = projectManager;
    }

    public abstract getPackage(): string;

    public abstract getPlatform(): ApplicationPlatform;

    public async install(installation: Installation): Promise<ProjectConfiguration> {
        const {input, output} = installation;

        const plan = await this.getInstallationPlan(installation);

        if (plan.tasks.length > 0) {
            output.break();
            output.inform('**Installation plan**');

            for (let index = 0; index < plan.tasks.length; index++) {
                output.log(` - ${plan.tasks[index].title}`);
            }

            output.break();

            if (!await input.confirm({message: 'Proceed?', default: true})) {
                output.alert('Installation aborted');

                return output.exit();
            }

            await output.monitor({tasks: plan.tasks});
        }

        return plan.configuration;
    }

    protected abstract getInstallationPlan(installation: Installation): Promise<InstallationPlan>;

    public updateContent(): Promise<void> {
        return Promise.resolve(undefined);
    }

    public updateTypes(): Promise<void> {
        return Promise.resolve(undefined);
    }
}
