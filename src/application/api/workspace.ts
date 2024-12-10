import {JsonObject} from '@croct/json';
import {Application, Component, Slot} from '@/application/model/entities';
import {WorkspacePath} from '@/application/api/organization';

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

export type LocalizedContent = {
    locale: string,
    content: JsonObject,
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

export interface WorkspaceApi {
    getSlots(path: WorkspacePath): Promise<Slot[]>;

    getSlot(criteria: SlotCriteria): Promise<Slot|null>;

    getComponents(path: WorkspacePath): Promise<Component[]>;

    getComponent(criteria: ComponentCriteria): Promise<Component|null>;

    getSlotStaticContent(path: SlotPath, majorVersion?: number): Promise<LocalizedContent[]>;

    generateTypes(typing: TargetTyping): Promise<string>;

    getApplications(path: WorkspacePath): Promise<Application[]>;

    getApplication(path: ApplicationPath): Promise<Application|null>;

    createApplication(application: NewApplication): Promise<Application>;
}
