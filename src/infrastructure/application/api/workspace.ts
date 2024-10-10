import {graphql, GraphqlClient} from '@/infrastructure/graphql';
import {NewApplication, WorkspaceApi} from '@/application/api/workspace';
import {Application, ApplicationEnvironment, Slot} from '@/application/model/entities';
import {generateAvailableSlug} from '@/infrastructure/application/api/utils/generateAvailableSlug';

export class GraphqlWorkspaceApi implements WorkspaceApi {
    private readonly client: GraphqlClient;

    public constructor(client: GraphqlClient) {
        this.client = client;
    }

    public async getApplication(
        organizationSlug: string,
        workspaceSlug: string,
        applicationSlug: string,
    ): Promise<Application|null> {
        const {data} = await this.client.execute(applicationQuery, {
            organizationSlug: organizationSlug,
            workspaceSlug: workspaceSlug,
            applicationSlug: applicationSlug,
        });

        const node = data.organization?.workspace?.application ?? null;

        if (node === null) {
            return null;
        }

        const {logo = null} = node;

        return {
            id: node.id,
            name: node.name,
            slug: node.slug,
            timeZone: node.settings.timeZone,
            website: node.website,
            environment: node.environment as any,
            platform: node.platform as any,
            publicId: node.publicId,
            trafficStatus: node.applicationStatus as any,
            ...(logo !== null ? {logo: logo} : {}),
        };
    }

    public async getApplications(organizationSlug: string, workspaceSlug: string): Promise<Application[]> {
        const {data} = await this.client.execute(applicationsQuery, {
            organizationSlug: organizationSlug,
            workspaceSlug: workspaceSlug,
        });

        const edges = data.organization?.workspace?.applications.edges ?? [];

        return edges.flatMap((edge): Application[] => {
            const node = edge?.node ?? null;

            if (node === null) {
                return [];
            }

            const {logo = null} = node;

            return [{
                id: node.id,
                name: node.name,
                slug: node.slug,
                timeZone: node.settings.timeZone,
                website: node.website,
                environment: node.environment as any,
                platform: node.platform as any,
                publicId: node.publicId,
                trafficStatus: node.applicationStatus as any,
                ...(logo !== null ? {logo: logo} : {}),
            }];
        });
    }

    public async createApplication(application: NewApplication): Promise<Application> {
        const {data} = await this.client.execute(createApplicationMutation, {
            workspaceId: application.workspaceId,
            payload: {
                name: application.name,
                website: application.website,
                environment: application.environment as any,
                platform: application.platform as any,
                timeZone: application.timeZone,
                slug: await this.generateApplicationSlug(
                    application.workspaceId,
                    application.name,
                    application.environment,
                ),
            },
        });

        const node = data.createWebApplication;

        const {logo = null} = node;

        return {
            id: node.id,
            name: node.name,
            slug: node.slug,
            timeZone: node.settings.timeZone,
            website: node.website,
            environment: node.environment as any,
            platform: node.platform as any,
            publicId: node.publicId,
            trafficStatus: node.applicationStatus as any,
            ...(logo !== null ? {logo: logo} : {}),
        };
    }

    public async getSlots(organizationSlug: string, workspaceSlug: string): Promise<Slot[]> {
        const {data} = await this.client.execute(slotQuery, {
            organizationSlug: organizationSlug,
            workspaceSlug: workspaceSlug,
        });

        const edges = data.organization?.workspace?.slots.edges ?? [];

        return edges.flatMap((edge): Slot[] => {
            const node = edge?.node ?? null;

            if (node === null) {
                return [];
            }

            return [{
                id: node.id,
                name: node.name,
                slug: node.customId,
                version: {
                    major: node.content.version.major,
                    minor: node.content.version.minor,
                },
            }];
        });
    }

    private generateApplicationSlug(
        workspaceId: string,
        baseName: string,
        environment: ApplicationEnvironment,
    ): Promise<string> {
        return generateAvailableSlug({
            query: applicationSlugQuery,
            baseName: `${baseName} ${environment.slice(0, 3).toLowerCase()}`,
            client: this.client,
            variables: {
                workspaceId: workspaceId,
            },
        });
    }
}

const applicationSlugQuery = graphql(`
    query FindApplicationSlug(
        $workspaceId: WorkspaceId!
        $slugFirstOption: ReadableId!
        $slugSecondOption: ReadableId!
        $slugThirdOption: ReadableId!
    ) {
        checkAvailability {
            slugFirstOption: applicationSlug(workspaceId: $workspaceId, slug: $slugFirstOption)
            slugSecondOption: applicationSlug(workspaceId: $workspaceId, slug: $slugSecondOption)
            slugThirdOption: applicationSlug(workspaceId: $workspaceId, slug: $slugThirdOption)
        }
    }
`);

const applicationsQuery = graphql(`
    query Applications($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                applications(first: 100) {
                    edges {
                        node {
                            id
                            publicId
                            name
                            slug
                            logo
                            website
                            environment
                            platform
                            applicationStatus
                            settings {
                                timeZone
                            }
                        }
                    }
                }
            }
        }
    }
`);

const applicationQuery = graphql(`
    query Application($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!, $applicationSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                application(slug: $applicationSlug) {
                    id
                    publicId
                    name
                    slug
                    logo
                    website
                    environment
                    platform
                    applicationStatus
                    settings {
                        timeZone
                    }
                }
            }
        }
    }
`);

const createApplicationMutation = graphql(`
    mutation CreateApplication($workspaceId: WorkspaceId!, $payload: CreateWebApplicationPayload!) {
        createWebApplication(workspaceId: $workspaceId, payload: $payload) {
            id
            publicId
            name
            slug
            logo
            website
            environment
            platform
            applicationStatus
            settings {
                timeZone
            }
        }
    }
`);

const slotQuery = graphql(`
    query Slots($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                slots(first: 100) {
                    edges {
                        node {
                            id
                            customId
                            name
                            content {
                                version {
                                    major
                                    minor
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`);
