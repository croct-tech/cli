import {FileSystem} from '@/application/fs/fileSystem';
import {Validator} from '@/application/validation';
import {CliSettings, CliSettingsStore} from '@/application/cli/settings/settings';

export type Configuration = {
    fileSystem: FileSystem,
    filePath: string,
    validator: Validator<CliSettings>,
};

export class FileSettingsStore implements CliSettingsStore {
    private static readonly EMPTY_SETTINGS: CliSettings = {projectPaths: []};

    private readonly fileSystem: FileSystem;

    private readonly validator: Validator<CliSettings>;

    private readonly filePath: string;

    public constructor({fileSystem, validator, filePath}: Configuration) {
        this.fileSystem = fileSystem;
        this.validator = validator;
        this.filePath = filePath;
    }

    public async getSettings(): Promise<CliSettings> {
        if (!await this.fileSystem.exists(this.filePath)) {
            return FileSettingsStore.EMPTY_SETTINGS;
        }

        let content: string;

        try {
            content = await this.fileSystem.readTextFile(this.filePath);
        } catch {
            return FileSettingsStore.EMPTY_SETTINGS;
        }

        const validation = await this.validator.validate(JSON.parse(content));

        return validation.valid ? validation.data : FileSettingsStore.EMPTY_SETTINGS;
    }

    public saveSettings(settings: CliSettings): Promise<void> {
        return this.fileSystem.writeTextFile(
            this.filePath,
            JSON.stringify(settings),
            {overwrite: true},
        );
    }
}
