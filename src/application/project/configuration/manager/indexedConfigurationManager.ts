import {
    Configuration as ProjectConfiguration,
    ResolvedConfiguration,
} from '@/application/project/configuration/configuration';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {WorkingDirectory} from '@/application/fs/workingDirectory';
import {CliSettingsStore} from '@/application/cli/settings/settings';

export type Configuration = {
    manager: ConfigurationManager,
    settingsStore: CliSettingsStore,
    workingDirectory: WorkingDirectory,
};

export class IndexedConfigurationManager implements ConfigurationManager {
    private readonly manager: ConfigurationManager;

    private readonly settingsTore: CliSettingsStore;

    private readonly workingDirectory: WorkingDirectory;

    public constructor({manager, workingDirectory, settingsStore}: Configuration) {
        this.manager = manager;
        this.workingDirectory = workingDirectory;
        this.settingsTore = settingsStore;
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
        const settings = await this.settingsTore.getSettings();

        await this.settingsTore.saveSettings({
            ...settings,
            projectPaths: [...settings.projectPaths, this.workingDirectory.get()],
        });
    }
}
