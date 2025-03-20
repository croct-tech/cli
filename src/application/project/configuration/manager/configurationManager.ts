import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';

export interface ConfigurationManager {
    isInitialized(): Promise<boolean>;

    load(): Promise<ProjectConfiguration>;

    update(configuration: ProjectConfiguration): Promise<ProjectConfiguration>;
}
