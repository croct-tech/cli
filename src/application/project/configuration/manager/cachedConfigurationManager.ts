import {
    PartialProjectConfiguration,
    ProjectConfiguration,
} from '@/application/project/configuration/projectConfiguration';
import {
    ConfigurationManager,
    InitializationState,
} from '@/application/project/configuration/manager/configurationManager';

export class CachedConfigurationManager implements ConfigurationManager {
    private readonly manager: ConfigurationManager;

    private configuration: Promise<ProjectConfiguration>;

    public constructor(manager: ConfigurationManager) {
        this.manager = manager;
    }

    public isInitialized(state?: InitializationState): Promise<boolean> {
        return this.manager.isInitialized(state);
    }

    public load(): Promise<ProjectConfiguration> {
        if (this.configuration === undefined) {
            this.configuration = this.manager.load();
        }

        return this.configuration;
    }

    public loadPartial(): Promise<PartialProjectConfiguration> {
        return this.manager.loadPartial();
    }

    public update(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        this.configuration = this.manager.update(configuration);

        return this.configuration;
    }
}
