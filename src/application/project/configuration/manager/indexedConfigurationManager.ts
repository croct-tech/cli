import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {CliConfigurationProvider} from '@/application/cli/configuration/provider';

export type Configuration = {
    manager: ConfigurationManager,
    configurationProvider: CliConfigurationProvider,
    workingDirectory: WorkingDirectory,
};

export class IndexedConfigurationManager implements ConfigurationManager {
    private readonly manager: ConfigurationManager;

    private readonly configurationProvider: CliConfigurationProvider;

    private readonly workingDirectory: WorkingDirectory;

    public constructor({manager, workingDirectory, configurationProvider}: Configuration) {
        this.manager = manager;
        this.workingDirectory = workingDirectory;
        this.configurationProvider = configurationProvider;
    }

    public isInitialized(): Promise<boolean> {
        return this.manager.isInitialized();
    }

    public async load(): Promise<ProjectConfiguration> {
        const configuration = await this.manager.load();

        await this.updateIndex();

        return configuration;
    }

    public update(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        return Promise.all([this.manager.update(configuration), this.updateIndex()])
            .then(([result]) => result);
    }

    private async updateIndex(): Promise<void> {
        const configuration = await this.configurationProvider.get();

        await this.configurationProvider.save({
            ...configuration,
            projectPaths: [this.workingDirectory.get(), ...configuration.projectPaths],
        });
    }
}
