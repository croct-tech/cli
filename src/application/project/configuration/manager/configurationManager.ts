import {ProjectConfiguration, ResolvedConfiguration} from '@/application/project/configuration/projectConfiguration';

export interface ConfigurationManager {
    load(): Promise<ProjectConfiguration | null>;

    resolve(): Promise<ResolvedConfiguration>;

    update(configuration: ProjectConfiguration): Promise<ProjectConfiguration>;
}
