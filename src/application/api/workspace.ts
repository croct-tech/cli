import {JsonObject} from '@croct/json';
import {Application, Slot} from '@/application/model/entities';
import {OrganizationPath} from '@/application/api/organization';

export type WorkspacePath = OrganizationPath & {
    workspaceSlug: string,
};

export type SlotPath = WorkspacePath & {
    slotSlug: string,
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

export interface WorkspaceApi {
    getSlots(path: WorkspacePath): Promise<Slot[]>;

    getSlotStaticContent(path: SlotPath, majorVersion?: number): Promise<LocalizedContent[]>;

    generateTypes(typing: TargetTyping): Promise<string>;

    getApplications(path: WorkspacePath): Promise<Application[]>;

    getApplication(path: ApplicationPath): Promise<Application|null>;

    createApplication(application: NewApplication): Promise<Application>;
}
