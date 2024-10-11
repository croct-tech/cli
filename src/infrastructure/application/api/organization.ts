import {graphql} from '@/infrastructure/graphql';
import {NewWorkspace, OrganizationApi, OrganizationPath} from '@/application/api/organization';
import {GraphqlClient} from '@/infrastructure/graphql/client';
import {Workspace} from '@/application/model/entities';
import {generateAvailableSlug} from '@/infrastructure/application/api/utils/generateAvailableSlug';

export class GraphqlOrganizationApi implements OrganizationApi {
    private readonly client: GraphqlClient;

    public constructor(client: GraphqlClient) {
        this.client = client;
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

            const {logo = null, website = null} = node;

            const workspace: Workspace = {
                id: node.id,
                name: node.name,
                slug: node.slug,
                timeZone: node.timeZone,
                defaultLocale: node.defaultLocale,
                ...(logo !== null ? {logo: logo} : {}),
                ...(website !== null ? {website: website} : {}),
            };

            return [workspace];
        });
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
        const {logo = null, website = null} = newWorkspace;

        return {
            id: newWorkspace.id,
            name: newWorkspace.name,
            slug: newWorkspace.slug,
            timeZone: newWorkspace.timeZone,
            defaultLocale: newWorkspace.defaultLocale,
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

const workspacesQuery = graphql(`
    query Workspaces($organizationSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspaces(first: 100) {
                edges {
                    node {
                        id
                        name
                        slug
                        logo
                        website
                        timeZone
                        defaultLocale
                    }
                }
            }
        }
    }
`);

const createWorkspaceMutation = graphql(`
    mutation CreateWorkspace($organizationId: OrganizationId!, $payload: CreateWorkspacePayload!) {
        createWorkspace(organizationId: $organizationId, payload: $payload) {
            id
            name
            slug
            logo
            website
            timeZone
            defaultLocale
        }
    }
`);

const workspaceSlugQuery = graphql(`
    query FindWorkspaceSlug(
        $organizationId: OrganizationId!
        $slugFirstOption: ReadableId!
        $slugSecondOption: ReadableId!
        $slugThirdOption: ReadableId!
    ) {
        checkAvailability {
            slugFirstOption: workspaceSlug(organizationId: $organizationId, slug: $slugFirstOption)
            slugSecondOption: workspaceSlug(organizationId: $organizationId, slug: $slugSecondOption)
            slugThirdOption: workspaceSlug(organizationId: $organizationId, slug: $slugThirdOption)
        }
    }
`);
