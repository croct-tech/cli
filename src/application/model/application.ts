import {Platform} from '@/application/model/platform';

export enum ApplicationEnvironment {
    DEVELOPMENT = 'DEVELOPMENT',
    PRODUCTION = 'PRODUCTION',
}

export namespace ApplicationEnvironment {
    export function getLabel(environment: ApplicationEnvironment): string {
        switch (environment) {
            case ApplicationEnvironment.DEVELOPMENT:
                return 'dev';

            case ApplicationEnvironment.PRODUCTION:
                return 'prod';
        }
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

export type ApiKey = {
    id: string,
    name: string,
    permissions: {
        tokenIssue?: boolean,
        dataExport?: boolean,
    },
};
