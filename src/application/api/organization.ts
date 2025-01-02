import {Workspace} from '@/application/model/workspace';

export type OrganizationPath = {
    organizationSlug: string,
};

export type WorkspacePath = OrganizationPath & {
    workspaceSlug: string,
};

export type NewWorkspace = Omit<Workspace, 'id' | 'slug' | 'logo' | 'locales'> & {
    organizationId: string,
};

export interface OrganizationApi {
    getWorkspaces(path: OrganizationPath): Promise<Workspace[]>;

    getWorkspace(path: WorkspacePath): Promise<Workspace|null>;

    createWorkspace(workspace: NewWorkspace): Promise<Workspace>;
}
