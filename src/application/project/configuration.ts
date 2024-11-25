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
    paths: {
        components: string,
        examples: string,
    },
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

export interface ProjectConfigurationManager {
    load(): Promise<ProjectConfiguration|null>;
    resolve(): Promise<ResolvedProjectConfiguration>;
    update(configuration: ProjectConfiguration): Promise<void>;
}
