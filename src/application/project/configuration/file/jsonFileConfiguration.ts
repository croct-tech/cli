import {join} from 'path';
import {readFile, writeFile} from 'fs/promises';
import {Configuration} from '@/application/project/configuration/configuration';
import {Version} from '@/application/project/version';
import {ConfigurationFile} from '@/application/project/configuration/file/configurationFile';

export class JsonFileConfiguration implements ConfigurationFile {
    private readonly projectDirectory: string;

    public constructor(projectDirectory: string) {
        this.projectDirectory = projectDirectory;
    }

    public async load(): Promise<Configuration|null> {
        const path = this.getConfigurationFilePath();

        try {
            const configuration = JSON.parse(await readFile(path, 'utf8'));

            return {
                ...configuration,
                components: Object.fromEntries(
                    Object.entries<string>(configuration.components)
                        .map(([key, value]) => [key, Version.parse(value)]),
                ),
                slots: Object.fromEntries(
                    Object.entries<string>(configuration.slots)
                        .map(([key, value]) => [key, Version.parse(value)]),
                ),
            };
        } catch {
            // Suppress error
            return null;
        }
    }

    public async update(configuration: Configuration): Promise<void> {
        const path = this.getConfigurationFilePath();

        const cleanedConfiguration: Configuration = {
            organization: configuration.organization,
            workspace: configuration.workspace,
            applications: {
                development: configuration.applications.development,
                production: configuration.applications.production,
            },
            defaultLocale: configuration.defaultLocale,
            locales: configuration.locales,
            slots: Object.fromEntries(
                Object.entries(configuration.slots)
                    .map(([key, value]) => [key, value]),
            ),
            components: Object.fromEntries(
                Object.entries(configuration.components)
                    .map(([key, value]) => [key, value]),
            ),
            paths: {
                components: configuration.paths.components,
                examples: configuration.paths.examples,
            },
        };

        const json = JSON.stringify(cleanedConfiguration, null, 4);

        try {
            // Overwrite the file
            await writeFile(path, json, {flag: 'w', encoding: 'utf8'});
        } catch {
            throw new Error(`Unable to write configuration file ${path}.`);
        }
    }

    private getConfigurationFilePath(): string {
        return join(this.projectDirectory, 'croct.json');
    }
}
