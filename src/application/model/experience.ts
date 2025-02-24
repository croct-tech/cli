import {JsonObject} from '@croct/json';
import {Content} from '@croct/content-model/content/content';

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

export type LocalizedContentMap = Record<string, Content<'structure'>>;

export type SlotContentMap = Record<string, LocalizedContentMap>;

export type SegmentedContent = {
    id: string,
    audiences: string[],
    content: SlotContentMap,
};

export type PersonalizedContent = {
    default: SlotContentMap,
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
    experiment?: {
        id?: string,
        name: string,
    },
    audiences: string[],
    slots: string[],
};

export type Variant = {
    id?: string,
    name?: string,
    allocation?: number,
    baseline?: boolean,
    content: PersonalizedContent,
};

export type ExperienceDetails = {
    id: string,
    name: string,
    priority: number,
    status: ExperienceStatus,
    hasExperiments: boolean,
    audiences: string[],
    slots: string[],
    experiment?: {
        status?: ExperimentStatus,
        name?: string,
        goalId?: string,
        crossDevice?: boolean,
        traffic?: number,
        variants: Variant[],
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
