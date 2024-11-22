import {Workspace} from '@/application/model/entities';

export type OrganizationPath = {
    organizationSlug: string,
};

export type NewWorkspace = Omit<Workspace, 'id' | 'slug' | 'logo' | 'locales'> & {
    organizationId: string,
};

export interface OrganizationApi {
    getWorkspaces(path: OrganizationPath): Promise<Workspace[]>;

    createWorkspace(workspace: NewWorkspace): Promise<Workspace>;
}
