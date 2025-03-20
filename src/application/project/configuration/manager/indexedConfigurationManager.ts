import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {CliConfigurationProvider} from '@/application/cli/configuration/store';

export type Configuration = {
    manager: ConfigurationManager,
    store: CliConfigurationProvider,
    workingDirectory: WorkingDirectory,
};

export class IndexedConfigurationManager implements ConfigurationManager {
    private readonly manager: ConfigurationManager;

    private readonly store: CliConfigurationProvider;

    private readonly workingDirectory: WorkingDirectory;

    public constructor({manager, workingDirectory, store}: Configuration) {
        this.manager = manager;
        this.workingDirectory = workingDirectory;
        this.store = store;
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
        const settings = await this.store.get();

        await this.store.save({
            ...settings,
            projectPaths: [this.workingDirectory.get(), ...settings.projectPaths],
        });
    }
}
