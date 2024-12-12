export type Configuration = {
    organization: string,
    workspace: string,
    applications: {
        development: string,
        production?: string,
    },
    defaultLocale: string,
    locales: string[],
    slots: Record<string, string>,
    components: Record<string, string>,
    paths: {
        components: string,
        examples: string,
    },
};

type DevelopmentApplicationIds = {
    development: string,
    developmentId: string,
    developmentPublicId: string,
};

type ProductionApplicationIds = {
    production: string,
    productionId: string,
    productionPublicId: string,
} | {
    production?: undefined,
    productionId?: undefined,
    productionPublicId?: undefined,
};

type ApplicationIds = DevelopmentApplicationIds & ProductionApplicationIds;

export type ResolvedConfiguration = Omit<Configuration, 'applications'> & {
    organizationId: string,
    workspaceId: string,
    applications: ApplicationIds,
};

export class ConfigurationError extends Error {
    public details: string[];

    public constructor(message: string, details: string[] = []) {
        super(message);

        this.details = details;

        Object.setPrototypeOf(this, ConfigurationError.prototype);
    }
}
