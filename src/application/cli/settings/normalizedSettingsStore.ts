import {FileSystem} from '@/application/fs/fileSystem';
import {CliSettings, CliSettingsStore} from '@/application/cli/settings/settings';

export type Configuration = {
    fileSystem: FileSystem,
    settingsStore: CliSettingsStore,
};

export class NormalizedSettingsStore implements CliSettingsStore {
    private readonly fileSystem: FileSystem;

    private readonly settingsStore: CliSettingsStore;

    public constructor({fileSystem, settingsStore}: Configuration) {
        this.fileSystem = fileSystem;
        this.settingsStore = settingsStore;
    }

    public async getSettings(): Promise<CliSettings> {
        return this.normalizeSettings(await this.settingsStore.getSettings());
    }

    public async saveSettings(settings: CliSettings): Promise<void> {
        return this.settingsStore.saveSettings(await this.normalizeSettings(settings));
    }

    private async normalizeSettings(settings: CliSettings): Promise<CliSettings> {
        return {
            ...settings,
            projectPaths: (await Promise.all(
                [...new Set(settings.projectPaths)].map(
                    async path => (await this.fileSystem.exists(path) ? [path] : []),
                ),
            )).flat(),
        };
    }
}
