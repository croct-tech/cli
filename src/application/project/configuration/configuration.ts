export type Configuration = {
    organization: string,
    workspace: string,
    applications: {
        development: string,
        production: string,
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

export class ConfigurationError extends Error {
    public details: string[];

    public constructor(message: string, details: string[] = []) {
        super(message);

        this.details = details;

        Object.setPrototypeOf(this, ConfigurationError.prototype);
    }
}
