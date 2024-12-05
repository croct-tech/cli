import {Version} from '@/application/project/version';

export type Configuration = {
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

export type ResolvedConfiguration = Configuration & {
    organizationId: string,
    workspaceId: string,
    applications: Configuration['applications'] & {
        developmentId: string,
        developmentPublicId: string,
        productionId: string,
        productionPublicId: string,
    },
};
