import {JsonValue} from '@croct/json';
import {JsonObjectNode, JsonParser} from '@croct/json5-parser';
import {
    PartialProjectConfiguration,
    ProjectConfiguration,
    ProjectConfigurationError,
} from '@/application/project/configuration/projectConfiguration';
import {FileSystem} from '@/application/fs/fileSystem';
import {Validator} from '@/application/validation';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {
    ConfigurationManager,
    InitializationState,
} from '@/application/project/configuration/manager/configurationManager';
import {ErrorReason} from '@/application/error';

type LoadedFile<T extends JsonPartialProjectConfiguration = JsonPartialProjectConfiguration> = {
    path: string,
    source: string|null,
    configuration: T|null,
};

export type JsonProjectConfiguration = ProjectConfiguration & {
    $schema?: string,
};

export type JsonPartialProjectConfiguration = PartialProjectConfiguration & {
    $schema?: string,
};

export type Configuration = {
    fileSystem: FileSystem,
    projectDirectory: WorkingDirectory,
    fullValidator: Validator<JsonProjectConfiguration>,
    partialValidator: Validator<JsonPartialProjectConfiguration>,
};

export class JsonConfigurationFileManager implements ConfigurationManager {
    private static readonly CONFIGURATION_SCHEMA = 'https://schema.croct.com/json/v1/project.json';

    private readonly fileSystem: FileSystem;

    private readonly projectDirectory: WorkingDirectory;

    private readonly fullValidator: Validator<ProjectConfiguration>;

    private readonly partialValidator: Validator<PartialProjectConfiguration>;

    public constructor({fileSystem, projectDirectory, fullValidator, partialValidator}: Configuration) {
        this.fileSystem = fileSystem;
        this.projectDirectory = projectDirectory;
        this.fullValidator = fullValidator;
        this.partialValidator = partialValidator;
    }

    public async isInitialized(state: InitializationState = InitializationState.ANY): Promise<boolean> {
        if (state === InitializationState.ANY) {
            return this.fileSystem.exists(this.getConfigurationFilePath());
        }

        const validator = state === InitializationState.FULL
            ? this.fullValidator
            : this.partialValidator;

        try {
            return (await this.loadConfigurationFile(validator)).configuration !== null;
        } catch (error) {
            if (error instanceof ProjectConfigurationError) {
                return false;
            }

            throw error;
        }
    }

    public async load(): Promise<ProjectConfiguration> {
        const {configuration} = await this.loadConfigurationFile(this.fullValidator);

        if (configuration === null) {
            throw new ProjectConfigurationError('Project configuration not found.', {
                reason: ErrorReason.NOT_FOUND,
                suggestions: [
                    'Run `init` command to initialize the project',
                ],
            });
        }

        return configuration;
    }

    public async loadPartial(): Promise<PartialProjectConfiguration> {
        let configuration: JsonPartialProjectConfiguration = {};

        try {
            configuration = (await this.loadConfigurationFile(this.partialValidator)).configuration ?? {};
        } catch (error) {
            if (!(error instanceof ProjectConfigurationError)) {
                throw error;
            }
        }

        return configuration;
    }

    public async update(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        return this.updateConfigurationFile(await this.validateConfiguration(this.fullValidator, configuration));
    }

    private async updateConfigurationFile(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        const file = await this.loadConfigurationFile(this.partialValidator);
        const source = this.applyConfigurationChanges(file, configuration);
        const json = source.toString({
            indentationCharacter: 'space',
            object: {
                indentationSize: 2,
                leadingIndentation: true,
                trailingIndentation: true,
                entryIndentation: true,
                colonSpacing: true,
                commaSpacing: true,
            },
            array: {
                indentationSize: 2,
                entryIndentation: true,
                leadingIndentation: true,
                trailingIndentation: true,
                colonSpacing: true,
                commaSpacing: true,
            },
        });

        try {
            await this.fileSystem.writeTextFile(file.path, json, {overwrite: true});
        } catch {
            throw new Error(`Unable to write configuration file ${file.path}.`);
        }

        return configuration;
    }

    private applyConfigurationChanges(file: LoadedFile, configuration: ProjectConfiguration): JsonObjectNode {
        if (file.configuration === null || file.source === null) {
            return JsonObjectNode.of({
                $schema: JsonConfigurationFileManager.CONFIGURATION_SCHEMA,
                ...configuration,
            });
        }

        const source = JsonParser.parse(file.source, JsonObjectNode);

        return source.update({
            $schema: source.has('$schema')
                ? source.get('$schema').toJSON()
                : undefined,
            ...configuration,
        }).cast(JsonObjectNode);
    }

    private async loadConfigurationFile<T extends JsonPartialProjectConfiguration>(
        validator: Validator<T>,
    ): Promise<LoadedFile<Omit<T, '$schema'>>> {
        const file: LoadedFile<T> = {
            path: this.getConfigurationFilePath(),
            source: null,
            configuration: null,
        };

        let configuration: JsonValue;

        try {
            file.source = await this.fileSystem.readTextFile(file.path);
            configuration = JsonParser.parse(file.source).toJSON();
        } catch {
            return file;
        }

        if (configuration !== null) {
            file.configuration = await this.validateConfiguration(validator, configuration, file);

            if (file.configuration?.$schema !== undefined) {
                delete file.configuration?.$schema;
            }
        }

        return file;
    }

    private getConfigurationFilePath(): string {
        return this.fileSystem.joinPaths(this.projectDirectory.get(), 'croct.json');
    }

    private async validateConfiguration<T extends JsonPartialProjectConfiguration>(
        validator: Validator<T>,
        value: JsonValue,
        file?: LoadedFile<T>,
    ): Promise<T> {
        const result = await validator.validate(value);

        if (!result.valid) {
            const violation = result.violations[0];

            throw new ProjectConfigurationError('The project configuration is invalid.', {
                details: [
                    ...(file !== undefined
                        ? [`File: file://${file.path.replace(/\\/g, '/')}`]
                        : []
                    ),
                    `Cause: ${violation.message}`,
                    `Violation path: ${violation.path}`,
                ],
            });
        }

        return result.data;
    }
}
