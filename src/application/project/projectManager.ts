import {ProjectConfiguration} from '@/application/model/project';

export interface ProjectManager {
    isInitialized(): Promise<boolean>;

    getConfiguration(): Promise<ProjectConfiguration|null>;

    updateConfiguration(configuration: ProjectConfiguration): Promise<void>;
}
