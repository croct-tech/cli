import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';

export interface ConfigurationInitializer {
    initialize(): Promise<void>;
}

export type Configuration = {
    manager: ConfigurationManager,
    initializer: ConfigurationInitializer,
};

export class NewConfigurationManager implements ConfigurationManager {
    private readonly manager: ConfigurationManager;

    private readonly initializer: ConfigurationInitializer;

    public constructor({manager, initializer}: Configuration) {
        this.manager = manager;
        this.initializer = initializer;
    }

    public isInitialized(): Promise<boolean> {
        return this.manager.isInitialized();
    }

    public async load(): Promise<ProjectConfiguration> {
        if (!await this.isInitialized()) {
            await this.initializer.initialize();
        }

        return this.manager.load();
    }

    public update(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        return this.manager.update(configuration);
    }
}
