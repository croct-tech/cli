import {
    Configuration as ProjectConfiguration,
    ResolvedConfiguration,
} from '@/application/project/configuration/configuration';
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

    public load(): Promise<ProjectConfiguration | null> {
        return this.manager.load();
    }

    public async resolve(): Promise<ResolvedConfiguration> {
        if (await this.load() === null) {
            await this.initializer.initialize();
        }

        return this.manager.resolve();
    }

    public update(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        return this.manager.update(configuration);
    }
}
