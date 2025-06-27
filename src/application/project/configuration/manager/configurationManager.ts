import {
    PartialProjectConfiguration,
    ProjectConfiguration,
} from '@/application/project/configuration/projectConfiguration';

export enum InitializationState {
    PARTIAL = 'partial',
    FULL = 'full',
    ANY = 'any',
}

export interface ConfigurationManager {
    isInitialized(state?: InitializationState): Promise<boolean>;

    load(): Promise<ProjectConfiguration>;

    loadPartial(): Promise<PartialProjectConfiguration>;

    update(configuration: ProjectConfiguration): Promise<ProjectConfiguration>;
}
