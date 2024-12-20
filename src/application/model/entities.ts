import {JsonObject} from '@croct/json';
import {RootDefinition} from '@/application/project/example/content-model/definitions';

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
    locales: string[],
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

export type Audience = {
    id: string,
    name: string,
    slug: string,
    criteria: string,
};

export type Slot = {
    id: string,
    name: string,
    slug: string,
    version: {
        major: number,
        minor: number,
    },
    resolvedDefinition: RootDefinition,
};

export type Component = {
    id: string,
    name: string,
    slug: string,
    version: {
        major: number,
        minor: number,
    },
};

export enum ExperienceStatus {
    ACTIVE = 'ACTIVE',
    ARCHIVED = 'ARCHIVED',
    DRAFT = 'DRAFT',
    PAUSED = 'PAUSED',
    SCHEDULED = 'SCHEDULED',
}

export type LocalizedContent = {
    locale: string,
    content: JsonObject,
};

export type LocalizedSlotContent = Record<string, Record<string, Record<string, any>>>;

export type SegmentedContent = {
    groupId: string,
    audiences: string[],
    content: LocalizedSlotContent,
};

export type PersonalizedContent = {
    default: LocalizedSlotContent,
    segmented: SegmentedContent[],
};

export type ExperimentVariant = {
    name: string,
    content: PersonalizedContent,
};

export type Experience = {
    id: string,
    name: string,
    priority: number,
    status: ExperienceStatus,
    hasExperiments: boolean,
    experiment?: {
        name?: string,
        goalId?: string,
        crossDevice?: boolean,
        traffic?: number,
        variants: Array<{
            name?: string,
            content: PersonalizedContent,
        }>,
    },
    content: PersonalizedContent,
};

export enum ExperimentStatus {
    ACTIVE = 'ACTIVE',
    DRAFT = 'DRAFT',
    FINISHED = 'FINISHED',
    INDIRECTLY_PAUSED = 'INDIRECTLY_PAUSED',
    PAUSED = 'PAUSED',
    SCHEDULED = 'SCHEDULED'
}

export type Experiment = {
    id: string,
    name: string,
    goalId?: string,
    traffic: number,
    crossDevice: boolean,
    status: ExperimentStatus,
    variants: ExperimentVariant[],
};
