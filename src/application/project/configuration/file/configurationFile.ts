import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';

export interface ConfigurationFile {
    load(): Promise<ProjectConfiguration | null>;

    update(configuration: ProjectConfiguration): Promise<ProjectConfiguration>;
}
