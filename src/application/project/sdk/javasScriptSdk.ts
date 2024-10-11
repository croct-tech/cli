import {Installation, Sdk} from '@/application/project/sdk/sdk';
import {ProjectManager} from '@/application/project/projectManager';
import {ApplicationPlatform} from '@/application/model/entities';
import {ProjectConfiguration} from '@/application/project/configuration';

export abstract class JavaScriptSdk implements Sdk {
    protected projectManager: ProjectManager;

    public constructor(projectManager: ProjectManager) {
        this.projectManager = projectManager;
    }

    public abstract getPackage(): string;

    public abstract getPlatform(): ApplicationPlatform;

    public async install(installation: Installation): Promise<ProjectConfiguration> {
        const spinner = installation.output.createSpinner('Installing SDK');

        await this.projectManager.installPackage(this.getPackage());

        spinner.succeed(`${this.getPackage()} installed`);

        return this.configure(installation);
    }

    protected abstract configure(installation: Installation): Promise<ProjectConfiguration>;

    public downloadContent(): Promise<void> {
        return Promise.resolve(undefined);
    }

    public downloadTypes(): Promise<void> {
        return Promise.resolve(undefined);
    }
}
