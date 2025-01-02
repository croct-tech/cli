import {WorkspacePath} from '@/application/api/organization';
import {Application} from '@/application/model/application';
import {Audience} from '@/application/model/audience';
import {Slot} from '@/application/model/slot';
import {Component} from '@/application/model/component';
import {Experience, ExperienceSummary, LocalizedContent} from '@/application/model/experience';

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

export type NewApplication = Omit<Application, 'id' | 'slug' | 'logo' | 'publicId' | 'trafficStatus'> & {
    organizationId: string,
    workspaceId: string,
};

export enum TargetSdk {
    JAVASCRIPT = 'PLUG_JS',
}

export type VersionSpecifier = {
    id: string,
    version: string,
};

export type TargetTyping = {
    workspaceId: string,
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

export interface WorkspaceApi {
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

    getExperiences(path: WorkspacePath): Promise<ExperienceSummary[]>;

    getExperience(path: ExperiencePath): Promise<Experience|null>;
}
