import {JsonValue} from '@croct/json';
import {
    Configuration as ProjectConfiguration,
    ConfigurationError as ProjectConfigurationError,
} from '@/application/project/configuration/configuration';
import {ConfigurationFile} from '@/application/project/configuration/file/configurationFile';
import {JsonObjectNode, JsonParser} from '@/infrastructure/json';
import {FileSystem} from '@/application/fs/fileSystem';
import {Validator} from '@/application/validation';

type LoadedFile = {
    path: string,
    source: string|null,
    configuration: ProjectConfiguration|null,
};

export type Configuration = {
    fileSystem: FileSystem,
    projectDirectory: string,
    validator: Validator<ProjectConfiguration>,
};

export class JsonFileConfiguration implements ConfigurationFile {
    private readonly fileSystem: FileSystem;

    private readonly projectDirectory: string;

    private readonly validator: Validator<ProjectConfiguration>;

    public constructor({fileSystem, projectDirectory, validator}: Configuration) {
        this.fileSystem = fileSystem;
        this.projectDirectory = projectDirectory;
        this.validator = validator;
    }

    public async load(): Promise<ProjectConfiguration|null> {
        return (await this.loadFile()).configuration;
    }

    public async update(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        return this.updateFile(await this.validateConfiguration(configuration));
    }

    private async updateFile(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        const cleanedConfiguration = JsonFileConfiguration.clean(configuration);
        const file = await this.loadFile();
        const data = file.configuration !== null && file.source !== null
            ? JsonParser.parse(file.source).update(cleanedConfiguration)
            : JsonObjectNode.of(cleanedConfiguration);

        const json = data.toString({
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

        return cleanedConfiguration;
    }

    private async loadFile(): Promise<LoadedFile> {
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
            file.configuration = JsonFileConfiguration.clean(
                await this.validateConfiguration(configuration, file),
            );
        }

        return file;
    }

    private getConfigurationFilePath(): string {
        return this.fileSystem.joinPaths(this.projectDirectory, 'croct.json');
    }

    private async validateConfiguration(value: JsonValue, file?: LoadedFile): Promise<ProjectConfiguration> {
        const result = await this.validator.validate(value);

        if (!result.valid) {
            const violation = result.violations[0];

            throw new ProjectConfigurationError(violation.message, {
                details: [
                    ...(file !== undefined
                        ? `Configuration file: ${this.fileSystem.getRelativePath(this.projectDirectory, file.path)}`
                        : []
                    ),
                    `Violation path: ${violation.path}`,
                ],
            });
        }

        return result.data;
    }

    private static clean(configuration: ProjectConfiguration): ProjectConfiguration {
        return {
            organization: configuration.organization,
            workspace: configuration.workspace,
            applications: {
                development: configuration.applications.development,
                production: configuration.applications.production,
            },
            defaultLocale: configuration.defaultLocale,
            locales: configuration.locales,
            slots: configuration.slots,
            components: configuration.components,
            paths: {
                components: configuration.paths.components,
                examples: configuration.paths.examples,
            },
        };
    }
}
