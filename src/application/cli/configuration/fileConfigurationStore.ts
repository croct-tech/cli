import {FileSystem} from '@/application/fs/fileSystem';
import {Validator} from '@/application/validation';
import {CliConfiguration, CliConfigurationProvider} from '@/application/cli/configuration/provider';

export type Configuration = {
    fileSystem: FileSystem,
    filePath: string,
    validator: Validator<CliConfiguration>,
};

export class FileConfigurationStore implements CliConfigurationProvider {
    private static readonly EMPTY_SETTINGS: CliConfiguration = {projectPaths: []};

    private readonly fileSystem: FileSystem;

    private readonly validator: Validator<CliConfiguration>;

    private readonly filePath: string;

    public constructor({fileSystem, validator, filePath}: Configuration) {
        this.fileSystem = fileSystem;
        this.validator = validator;
        this.filePath = filePath;
    }

    public async get(): Promise<CliConfiguration> {
        if (!await this.fileSystem.exists(this.filePath)) {
            return FileConfigurationStore.EMPTY_SETTINGS;
        }

        let content: string;

        try {
            content = await this.fileSystem.readTextFile(this.filePath);
        } catch {
            return FileConfigurationStore.EMPTY_SETTINGS;
        }

        const validation = await this.validator.validate(JSON.parse(content));

        return validation.valid ? validation.data : FileConfigurationStore.EMPTY_SETTINGS;
    }

    public save(settings: CliConfiguration): Promise<void> {
        return this.fileSystem.writeTextFile(
            this.filePath,
            JSON.stringify(settings),
            {overwrite: true},
        );
    }
}
