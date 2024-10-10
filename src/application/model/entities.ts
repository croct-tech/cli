export enum Expertise {
    DESIGN = 'DESIGN',
    ENGINEERING = 'ENGINEERING',
    MARKETING = 'MARKETING',
    OTHER = 'OTHER',
    PRODUCT = 'PRODUCT'
}

export type User = {
    id: string,
    username: string,
    email: string,
    firstName: string,
    lastName?: string,
    expertise: Expertise,
};

export enum OrganizationType {
    PERSONAL = 'PERSONAL',
    BUSINESS = 'BUSINESS',
}

export type Organization = {
    type: OrganizationType,
    id: string,
    slug: string,
    name: string,
    email: string,
    logo?: string,
    website?: string,
};

export type Workspace = {
    id: string,
    name: string,
    logo?: string,
    slug: string,
    defaultLocale: string,
    timeZone: string,
    website?: string,
};

export enum ApplicationPlatform {
    NEXT = 'NEXT',
    REACT = 'REACT',
    JAVASCRIPT = 'JAVASCRIPT',
}

export namespace ApplicationPlatform {
    export function getName(platform: ApplicationPlatform): string {
        switch (platform) {
            case ApplicationPlatform.NEXT:
                return 'Next.js';

            case ApplicationPlatform.REACT:
                return 'React';

            case ApplicationPlatform.JAVASCRIPT:
                return 'JavaScript';
        }
    }
}

export enum ApplicationEnvironment {
    DEVELOPMENT = 'DEVELOPMENT',
    PRODUCTION = 'PRODUCTION',
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
    platform: ApplicationPlatform,
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

export type Slot = {
    id: string,
    name: string,
    slug: string,
    version: {
        major: number,
        minor: number,
    },
};
