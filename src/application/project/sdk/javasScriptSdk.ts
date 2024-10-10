import {Installation, Sdk} from '@/application/project/sdk/sdk';
import {PackageManager} from '@/application/project/packageManager';
import {ApplicationPlatform} from '@/application/model/entities';
import {ProjectConfiguration} from '@/application/model/project';

export abstract class JavaScriptSdk implements Sdk {
    protected packageManager: PackageManager;

    public constructor(packageManager: PackageManager) {
        this.packageManager = packageManager;
    }

    public abstract getPackage(): string;

    public abstract getPlatform(): ApplicationPlatform;

    public async install(installation: Installation): Promise<ProjectConfiguration> {
        const spinner = installation.output.createSpinner('Installing SDK');

        await this.packageManager.installPackage(this.getPackage());

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
