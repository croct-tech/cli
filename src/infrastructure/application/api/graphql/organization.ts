import {NewWorkspace, OrganizationApi, OrganizationPath, WorkspacePath} from '@/application/api/organization';
import {GraphqlClient} from '@/infrastructure/graphql/client';
import {generateAvailableSlug} from '@/infrastructure/application/api/utils/generateAvailableSlug';
import {WorkspaceQuery} from '@/infrastructure/graphql/schema/graphql';
import {
    createWorkspaceMutation,
    workspaceQuery,
    workspaceSlugAvailabilityQuery,
    workspacesQuery,
} from '@/infrastructure/application/api/graphql/queries/workspace';
import {Workspace} from '@/application/model/workspace';
import {HierarchyResolver} from '@/infrastructure/application/api/graphql/hierarchyResolver';

type WorkspaceData = NonNullable<NonNullable<WorkspaceQuery['organization']>['workspace']>;

export class GraphqlOrganizationApi implements OrganizationApi {
    private readonly client: GraphqlClient;

    private readonly hierarchyResolver: HierarchyResolver;

    public constructor(client: GraphqlClient, hierarchyResolver: HierarchyResolver) {
        this.client = client;
        this.hierarchyResolver = hierarchyResolver;
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
        const hierarchy = await this.hierarchyResolver.getHierarchy({
            organizationSlug: workspace.organizationSlug,
        });

        const {data} = await this.client.execute(createWorkspaceMutation, {
            organizationId: hierarchy.organizationId,
            payload: {
                name: workspace.name,
                slug: await this.generateWorkspaceSlug(hierarchy.organizationId, workspace.name),
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
            query: workspaceSlugAvailabilityQuery,
            baseName: baseName,
            client: this.client,
            variables: {
                organizationId: organizationId,
            },
        });
    }
}
