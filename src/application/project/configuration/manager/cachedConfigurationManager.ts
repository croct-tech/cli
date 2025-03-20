import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';

export class CachedConfigurationManager implements ConfigurationManager {
    private readonly manager: ConfigurationManager;

    private configuration: Promise<ProjectConfiguration>;

    public constructor(manager: ConfigurationManager) {
        this.manager = manager;
    }

    public isInitialized(): Promise<boolean> {
        return this.manager.isInitialized();
    }

    public load(): Promise<ProjectConfiguration> {
        if (this.configuration === undefined) {
            this.configuration = this.manager.load();
        }

        return this.configuration;
    }

    public update(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        this.configuration = this.manager.update(configuration);

        return this.configuration;
    }
}
