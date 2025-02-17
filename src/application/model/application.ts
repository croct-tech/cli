import {Platform} from '@/application/model/platform';

export enum ApplicationEnvironment {
    DEVELOPMENT = 'DEVELOPMENT',
    PRODUCTION = 'PRODUCTION',
}

export namespace ApplicationEnvironment {
    export function getLabel(environment: ApplicationEnvironment): string {
        switch (environment) {
            case ApplicationEnvironment.DEVELOPMENT:
                return 'Development';

            case ApplicationEnvironment.PRODUCTION:
                return 'Production';
        }
    }

    export function all(): ApplicationEnvironment[] {
        return Object.values(ApplicationEnvironment)
            .filter(value => typeof value === 'string');
    }

    export function fromValue(value: string): ApplicationEnvironment {
        const environment = value.toUpperCase() as ApplicationEnvironment;

        if (!ApplicationEnvironment.all().includes(environment)) {
            throw new Error(`Invalid environment value "${value}".`);
        }

        return environment;
    }
}

export enum ApplicationTrafficStatus {
    NEVER_RECEIVED_TRAFFIC = 'NEVER_RECEIVED_TRAFFIC',
    NOT_RECEIVING_TRAFFIC = 'NOT_RECEIVING_TRAFFIC',
    RECEIVING_TRAFFIC = 'RECEIVING_TRAFFIC',
}

export type Application = {
    id: string,
    publicId: string,
    slug: string,
    name: string,
    logo?: string,
    timeZone: string,
    website: string,
    environment: ApplicationEnvironment,
    platform: Platform,
    trafficStatus: ApplicationTrafficStatus,
};

export enum ApiKeyPermission {
    READ_RESOURCES = 'RESOURCE_READ_ACCESS',
    ISSUE_TOKEN = 'TOKEN_ISSUE',
    EXPORT_DATA = 'DATA_EXPORT',
}

export namespace ApiKeyPermission {
    export function getLabel(permission: ApiKeyPermission): string {
        switch (permission) {
            case ApiKeyPermission.READ_RESOURCES:
                return 'Read resources';

            case ApiKeyPermission.ISSUE_TOKEN:
                return 'Issue tokens';

            case ApiKeyPermission.EXPORT_DATA:
                return 'Export data';
        }
    }

    export function all(): ApiKeyPermission[] {
        return Object.values(ApiKeyPermission)
            .filter(value => typeof value === 'string');
    }

    export function fromValue(value: string): ApiKeyPermission {
        const permission = value.toUpperCase() as ApiKeyPermission;

        if (!ApiKeyPermission.all().includes(permission)) {
            throw new Error(`Invalid permission value "${value}".`);
        }

        return permission;
    }
}

export type ApiKey = {
    id: string,
    name: string,
    permissions: ApiKeyPermission[],
};
