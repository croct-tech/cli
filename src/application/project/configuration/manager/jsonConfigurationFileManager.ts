import {JsonValue} from '@croct/json';
import {JsonObjectNode, JsonParser} from '@croct/json5-parser';
import {
    ProjectConfiguration,
    ProjectConfigurationError,
} from '@/application/project/configuration/projectConfiguration';
import {FileSystem} from '@/application/fs/fileSystem';
import {Validator} from '@/application/validation';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {ErrorReason} from '@/application/error';

type LoadedFile = {
    path: string,
    source: string|null,
    configuration: JsonProjectConfiguration|null,
};

export type JsonProjectConfiguration = ProjectConfiguration & {
    $schema?: string,
};

export type Configuration = {
    fileSystem: FileSystem,
    projectDirectory: WorkingDirectory,
    validator: Validator<JsonProjectConfiguration>,
};

export class JsonConfigurationFileManager implements ConfigurationManager {
    private static readonly CONFIGURATION_SCHEMA = 'https://schema.croct.com/json/v1/project.json';

    private readonly fileSystem: FileSystem;

    private readonly projectDirectory: WorkingDirectory;

    private readonly validator: Validator<ProjectConfiguration>;

    public constructor({fileSystem, projectDirectory, validator}: Configuration) {
        this.fileSystem = fileSystem;
        this.projectDirectory = projectDirectory;
        this.validator = validator;
    }

    public isInitialized(): Promise<boolean> {
        return this.fileSystem.exists(this.getConfigurationFilePath());
    }

    public async load(): Promise<ProjectConfiguration> {
        const file = await this.loadConfigurationFile();

        if (file.configuration === null) {
            throw new ProjectConfigurationError('Project configuration not found.', {
                reason: ErrorReason.NOT_FOUND,
                suggestions: [
                    'Run `init` command to initialize the project',
                ],
            });
        }

        return file.configuration;
    }

    public async update(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        return this.updateConfigurationFile(await this.validateConfiguration(configuration));
    }

    private async updateConfigurationFile(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        const file = await this.loadConfigurationFile();
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

    private async loadConfigurationFile(): Promise<LoadedFile> {
        const file: LoadedFile = {
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
            file.configuration = await this.validateConfiguration(configuration, file);

            if (file.configuration?.$schema !== undefined) {
                delete file.configuration?.$schema;
            }
        }

        return file;
    }

    private getConfigurationFilePath(): string {
        return this.fileSystem.joinPaths(this.projectDirectory.get(), 'croct.json');
    }

    private async validateConfiguration(value: JsonValue, file?: LoadedFile): Promise<JsonProjectConfiguration> {
        const result = await this.validator.validate(value);

        if (!result.valid) {
            const violation = result.violations[0];

            throw new ProjectConfigurationError(violation.message, {
                details: [
                    ...(file !== undefined
                        ? [`File: file://${file.path.replace(/\\/g, '/')}`]
                        : []
                    ),
                    `Violation path: ${violation.path}`,
                ],
            });
        }

        return result.data;
    }
}
