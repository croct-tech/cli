import {FileSystem} from '@/application/fs/fileSystem';
import {CliConfiguration, CliConfigurationProvider} from '@/application/cli/configuration/store';

export type Configuration = {
    fileSystem: FileSystem,
    store: CliConfigurationProvider,
};

export class NormalizedConfigurationStore implements CliConfigurationProvider {
    private readonly fileSystem: FileSystem;

    private readonly store: CliConfigurationProvider;

    public constructor({fileSystem, store}: Configuration) {
        this.fileSystem = fileSystem;
        this.store = store;
    }

    public async get(): Promise<CliConfiguration> {
        return this.normalizeSettings(await this.store.get());
    }

    public async save(settings: CliConfiguration): Promise<void> {
        return this.store.save(await this.normalizeSettings(settings));
    }

    private async normalizeSettings(settings: CliConfiguration): Promise<CliConfiguration> {
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
