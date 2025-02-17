import {ErrorReason, Help, HelpfulError} from '@/application/error';

export type ProjectConfiguration = {
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

export type ResolvedConfiguration = Omit<ProjectConfiguration, 'applications'> & {
    organizationId: string,
    workspaceId: string,
    applications: ApplicationIds,
};

export class ConfigurationError extends HelpfulError {
    public constructor(message: string, help: Help = {}) {
        super(message, {
            ...help,
            reason: help.reason ?? ErrorReason.INVALID_CONFIGURATION,
        });

        Object.setPrototypeOf(this, ConfigurationError.prototype);
    }
}
