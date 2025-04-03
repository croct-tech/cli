import {RootDefinition} from '@croct/content-model/definition/definition';
import {WorkspacePath} from '@/application/api/organization';
import {Application} from '@/application/model/application';
import {Audience} from '@/application/model/audience';
import {Slot} from '@/application/model/slot';
import {Component} from '@/application/model/component';
import {
    ExperienceDetails,
    ExperienceStatus,
    Experience,
    LocalizedContent,
    LocalizedContentMap,
    SlotContentMap,
    SegmentedContent,
} from '@/application/model/experience';
import {WorkspaceFeatures} from '@/application/model/workspace';

export type AudiencePath = WorkspacePath & {
    audienceSlug: string,
};

export type SlotPath = WorkspacePath & {
    slotSlug: string,
};

export type SlotCriteria = SlotPath & {
    majorVersion?: number,
};

export type ApplicationPath = WorkspacePath & {
    applicationSlug: string,
};

export type NewApplication = WorkspacePath & Omit<Application, 'id' | 'slug' | 'logo' | 'publicId' | 'trafficStatus'>;

export enum TargetSdk {
    JAVASCRIPT = 'PLUG_JS',
}

export type VersionSpecifier = {
    id: string,
    version: string,
};

export type TargetTyping = WorkspacePath & {
    target: TargetSdk,
    components: VersionSpecifier[],
    slots: VersionSpecifier[],
};

export type ComponentPath = WorkspacePath & {
    componentSlug: string,
};

export type ComponentCriteria = ComponentPath & {
    majorVersion?: number,
};

export type ExperiencePath = WorkspacePath & {
    experienceId: string,
};

export type ExperienceCriteria = WorkspacePath & {
    status?: ExperienceStatus|ExperienceStatus[],
};

export type SegmentedContentDefinition = Omit<SegmentedContent, 'id'>;

export type PersonalizedContentDefinition = {
    default: SlotContentMap,
    segmented: SegmentedContentDefinition[],
};

export type SlotDefinition = {
    name: string,
    component: string,
    content: LocalizedContentMap,
};

export type ComponentDefinition = {
    name: string,
    description?: string,
    schema: RootDefinition,
};

export type AudienceDefinition = {
    name: string,
    criteria: string,
};

export type VariantDefinition = {
    name?: string,
    content: PersonalizedContentDefinition,
    baseline?: boolean,
    allocation?: number,
};

export type ExperienceDefinition = {
    name: string,
    draft?: boolean,
    audiences: string[],
    slots: string[],
    experiment?: {
        name: string,
        goalId?: string,
        crossDevice?: boolean,
        traffic: number,
        variants: VariantDefinition[],
    },
    content: PersonalizedContentDefinition,
};

export type NewResources = WorkspacePath & {
    components?: Record<string, ComponentDefinition>,
    slots?: Record<string, SlotDefinition>,
    audiences?: Record<string, AudienceDefinition>,
    experiences?: ExperienceDefinition[],
};

export type NewResourceIds = {
    components: Record<string, string>,
    slots: Record<string, string>,
    audiences: Record<string, string>,
    experiences: Array<{experienceId: string, experimentId?: string}>,
};

export interface WorkspaceApi {
    getFeatures(path: WorkspacePath): Promise<WorkspaceFeatures|null>;

    getAudiences(path: WorkspacePath): Promise<Audience[]>;

    getAudience(path: AudiencePath): Promise<Audience|null>;

    getSlots(path: WorkspacePath): Promise<Slot[]>;

    getSlot(criteria: SlotCriteria): Promise<Slot|null>;

    getComponents(path: WorkspacePath): Promise<Component[]>;

    getComponent(criteria: ComponentCriteria): Promise<Component|null>;

    getSlotStaticContent(path: SlotPath, majorVersion?: number): Promise<LocalizedContent[]>;

    generateTypes(typing: TargetTyping): Promise<string>;

    getApplications(path: WorkspacePath): Promise<Application[]>;

    getApplication(path: ApplicationPath): Promise<Application|null>;

    createApplication(application: NewApplication): Promise<Application>;

    getExperiences(path: ExperienceCriteria): Promise<Experience[]>;

    getExperience(path: ExperiencePath): Promise<ExperienceDetails|null>;

    createResources(resources: NewResources): Promise<NewResourceIds>;
}
