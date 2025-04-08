import {FileSystem} from '@/application/fs/fileSystem';
import {CliConfiguration, CliConfigurationProvider} from '@/application/cli/configuration/provider';

export type Configuration = {
    fileSystem: FileSystem,
    configurationProvider: CliConfigurationProvider,
};

export class NormalizedConfigurationStore implements CliConfigurationProvider {
    private readonly fileSystem: FileSystem;

    private readonly configurationProvider: CliConfigurationProvider;

    public constructor({fileSystem, configurationProvider}: Configuration) {
        this.fileSystem = fileSystem;
        this.configurationProvider = configurationProvider;
    }

    public async get(): Promise<CliConfiguration> {
        return this.normalizeSettings(await this.configurationProvider.get());
    }

    public async save(settings: CliConfiguration): Promise<void> {
        return this.configurationProvider.save(await this.normalizeSettings(settings));
    }

    private async normalizeSettings(configuration: CliConfiguration): Promise<CliConfiguration> {
        return {
            ...configuration,
            projectPaths: (await Promise.all(
                [...new Set(configuration.projectPaths)].map(
                    async path => (await this.fileSystem.exists(path) ? [path] : []),
                ),
            )).flat(),
        };
    }
}
