import {join} from 'path';
import {access, readFile, writeFile} from 'fs/promises';
import {ProjectConfiguration} from '@/application/project/configuration';
import {Version} from '@/application/project/version';
import {ProjectConfigurationFile} from '@/infrastructure/project/configurationFileManager';

export class JsonFileConfiguration implements ProjectConfigurationFile {
    private readonly projectDirectory: string;

    public constructor(projectDirectory: string) {
        this.projectDirectory = projectDirectory;
    }

    public async exists(): Promise<boolean> {
        try {
            await access(this.getConfigurationFilePath());

            return true;
        } catch {
            return false;
        }
    }

    public async load(): Promise<ProjectConfiguration|null> {
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

    public async update(configuration: ProjectConfiguration): Promise<void> {
        const path = this.getConfigurationFilePath();

        const cleanedConfiguration: ProjectConfiguration = {
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
