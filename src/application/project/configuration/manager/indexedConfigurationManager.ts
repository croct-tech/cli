import {ProjectConfiguration, ResolvedConfiguration} from '@/application/project/configuration/projectConfiguration';
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

    public async load(): Promise<ProjectConfiguration | null> {
        const configuration = await this.manager.load();

        if (configuration !== null) {
            await this.recordPath();
        }

        return configuration;
    }

    public async resolve(): Promise<ResolvedConfiguration> {
        const configuration = await this.manager.resolve();

        if (configuration === null) {
            await this.recordPath();
        }

        return configuration;
    }

    public async update(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        const [updatedConfiguration] = await Promise.all([this.manager.update(configuration), this.recordPath()]);

        return updatedConfiguration;
    }

    private async recordPath(): Promise<void> {
        const settings = await this.store.get();

        await this.store.save({
            ...settings,
            projectPaths: [this.workingDirectory.get(), ...settings.projectPaths],
        });
    }
}
