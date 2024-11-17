import {Version} from '@/application/project/version';

export type ProjectConfiguration = {
    organization: string,
    workspace: string,
    applications: {
        development: string,
        production: string,
    },
    defaultLocale: string,
    locales: string[],
    slots: Record<string, Version>,
    components: Record<string, Version>,
};

export type ResolvedProjectConfiguration = ProjectConfiguration & {
    organizationId: string,
    workspaceId: string,
    applications: ProjectConfiguration['applications'] & {
        developmentId: string,
        developmentPublicId: string,
        productionId: string,
        productionPublicId: string,
    },
};

export interface ProjectConfigurationFile {
    exists(): Promise<boolean>;

    load(): Promise<ProjectConfiguration | null>;

    update(configuration: ProjectConfiguration): Promise<void>;
}
