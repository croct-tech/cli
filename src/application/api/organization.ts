import {Workspace} from '@/application/model/entities';

export type NewWorkspace = Omit<Workspace, 'id' | 'slug' | 'logo'> & {
    organizationId: string,
};

export interface OrganizationApi {
    getWorkspaces(organizationSlug: string): Promise<Workspace[]>;

    createWorkspace(workspace: NewWorkspace): Promise<Workspace>;
}
