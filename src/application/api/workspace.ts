import {Application, Slot} from '@/application/model/entities';

export type NewApplication = Omit<Application, 'id' | 'slug' | 'logo' | 'publicId' | 'trafficStatus'> & {
    organizationId: string,
    workspaceId: string,
};

export interface WorkspaceApi {
    getSlots(organizationSlug: string, workspaceSlug: string): Promise<Slot[]>;

    getApplications(organizationSlug: string, workspaceSlug: string): Promise<Application[]>;

    getApplication(organizationSlug: string, workspaceSlug: string, applicationSlug: string): Promise<Application|null>;

    createApplication(application: NewApplication): Promise<Application>;
}
