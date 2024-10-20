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

    public abstract install(installation: Installation): Promise<ProjectConfiguration>;

    public downloadContent(): Promise<void> {
        return Promise.resolve(undefined);
    }

    public downloadTypes(): Promise<void> {
        return Promise.resolve(undefined);
    }
}
