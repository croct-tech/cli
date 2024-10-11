import {join} from 'path';
import {access, readFile, writeFile} from 'fs/promises';
import {ProjectConfiguration, ProjectConfigurationFile} from '@/application/project/configuration';

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
            const json = await readFile(path, 'utf8');

            // @todo: Validate configuration
            return JSON.parse(json);
        } catch {
            // Suppress error
            return null;
        }
    }

    public async update(configuration: ProjectConfiguration): Promise<void> {
        const path = this.getConfigurationFilePath();
        const json = JSON.stringify(configuration, null, 4);

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
