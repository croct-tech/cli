import {
    Configuration as ProjectConfiguration,
    ResolvedConfiguration,
} from '@/application/project/configuration/configuration';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {ProjectIndex} from '@/application/project/index/projectIndex';
import {WorkingDirectory} from '@/application/fs/workingDirectory';

export type Configuration = {
    manager: ConfigurationManager,
    projectIndex: ProjectIndex,
    workingDirectory: WorkingDirectory,
};

export class IndexedConfigurationManager implements ConfigurationManager {
    private readonly manager: ConfigurationManager;

    private readonly index: ProjectIndex;

    private readonly workingDirectory: WorkingDirectory;

    public constructor({manager, workingDirectory, projectIndex}: Configuration) {
        this.manager = manager;
        this.workingDirectory = workingDirectory;
        this.index = projectIndex;
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
        await this.index.addPath(this.workingDirectory.get());
    }
}
