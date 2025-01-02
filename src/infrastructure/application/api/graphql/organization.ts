import {NewWorkspace, OrganizationApi, OrganizationPath, WorkspacePath} from '@/application/api/organization';
import {GraphqlClient} from '@/infrastructure/graphql/client';
import {generateAvailableSlug} from '@/infrastructure/application/api/utils/generateAvailableSlug';
import {WorkspaceQuery} from '@/infrastructure/graphql/schema/graphql';
import {
    createWorkspaceMutation,
    workspaceQuery,
    workspaceSlugQuery,
    workspacesQuery,
} from '@/infrastructure/application/api/graphql/queries/workspace';
import {Workspace} from '@/application/model/workspace';

type WorkspaceData = NonNullable<NonNullable<WorkspaceQuery['organization']>['workspace']>;

export class GraphqlOrganizationApi implements OrganizationApi {
    private readonly client: GraphqlClient;

    public constructor(client: GraphqlClient) {
        this.client = client;
    }

    public async getWorkspace(path: WorkspacePath): Promise<Workspace | null> {
        const {data} = await this.client.execute(workspaceQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
        });

        const workspace = data.organization?.workspace ?? null;

        if (workspace === null) {
            return null;
        }

        return GraphqlOrganizationApi.normalizeWorkspace(workspace);
    }

    public async getWorkspaces(path: OrganizationPath): Promise<Workspace[]> {
        const {data} = await this.client.execute(workspacesQuery, {
            organizationSlug: path.organizationSlug,
        });

        const edges = data.organization?.workspaces.edges ?? [];

        return edges.flatMap((edge): Workspace[] => {
            const node = edge?.node ?? null;

            if (node === null) {
                return [];
            }

            return [GraphqlOrganizationApi.normalizeWorkspace(node)];
        });
    }

    private static normalizeWorkspace(data: WorkspaceData): Workspace {
        const {logo = null, website = null, locales: {edges: locales = []}} = data;

        return {
            id: data.id,
            name: data.name,
            slug: data.slug,
            timeZone: data.timeZone,
            defaultLocale: data.defaultLocale,
            locales: locales?.flatMap(locale => {
                const code = locale?.node?.code ?? null;

                if (code === null) {
                    return [];
                }

                return [code];
            }) ?? [],
            ...(logo !== null ? {logo: logo} : {}),
            ...(website !== null ? {website: website} : {}),
        };
    }

    public async createWorkspace(workspace: NewWorkspace): Promise<Workspace> {
        const {data} = await this.client.execute(createWorkspaceMutation, {
            organizationId: workspace.organizationId,
            payload: {
                name: workspace.name,
                slug: await this.generateWorkspaceSlug(workspace.organizationId, workspace.name),
                timeZone: workspace.timeZone,
                defaultLocale: workspace.defaultLocale,
                website: workspace.website,
            },
        });

        const newWorkspace = data.createWorkspace;
        const {logo = null, website = null, locales: {edges: locales = []}} = newWorkspace;

        return {
            id: newWorkspace.id,
            name: newWorkspace.name,
            slug: newWorkspace.slug,
            timeZone: newWorkspace.timeZone,
            defaultLocale: newWorkspace.defaultLocale,
            locales: locales?.flatMap(locale => {
                const code = locale?.node?.code ?? null;

                if (code === null) {
                    return [];
                }

                return [code];
            }) ?? [],
            ...(logo !== null ? {logo: logo} : {}),
            ...(website !== null ? {website: website} : {}),
        };
    }

    private generateWorkspaceSlug(organizationId: string, baseName: string): Promise<string> {
        return generateAvailableSlug({
            query: workspaceSlugQuery,
            baseName: baseName,
            client: this.client,
            variables: {
                organizationId: organizationId,
            },
        });
    }
}
