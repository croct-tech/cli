import {graphql, GraphqlClient} from '@/infrastructure/graphql';
import {
    ApplicationPath,
    LocalizedContent,
    NewApplication,
    SlotPath,
    TargetTyping,
    WorkspaceApi,
    WorkspacePath,
} from '@/application/api/workspace';
import {Application, ApplicationEnvironment, Component, Slot} from '@/application/model/entities';
import {generateAvailableSlug} from '@/infrastructure/application/api/utils/generateAvailableSlug';

export class GraphqlWorkspaceApi implements WorkspaceApi {
    private readonly client: GraphqlClient;

    public constructor(client: GraphqlClient) {
        this.client = client;
    }

    public async getApplication(path: ApplicationPath): Promise<Application|null> {
        const {data} = await this.client.execute(applicationQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
            applicationSlug: path.applicationSlug,
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

    public async getApplications(path: WorkspacePath): Promise<Application[]> {
        const {data} = await this.client.execute(applicationsQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
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

    public async getSlots(path: WorkspacePath): Promise<Slot[]> {
        const {data} = await this.client.execute(slotQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
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
                resolvedDefinition: node.content.componentDefinition.resolvedDefinition,
            }];
        });
    }

    public async getComponents(path: WorkspacePath): Promise<Component[]> {
        const {data} = await this.client.execute(componentQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
        });

        const edges = data.organization?.workspace?.components.edges ?? [];

        return edges.flatMap((edge): Component[] => {
            const node = edge?.node ?? null;

            if (node === null) {
                return [];
            }

            return [{
                id: node.id,
                name: node.name,
                slug: node.customId,
                version: {
                    major: node.definition.version.major,
                    minor: node.definition.version.minor,
                },
            }];
        });
    }

    public async getSlotStaticContent(path: SlotPath, majorVersion?: number): Promise<LocalizedContent[]> {
        const {data} = await this.client.execute(slotStaticContentQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
            slotSlug: path.slotSlug,
            majorVersion: majorVersion,
        });

        const contents = data.organization?.workspace?.slot?.staticContent ?? [];

        return contents.map(
            content => ({
                locale: content.locale,
                content: content.content,
            }),
        );
    }

    public async generateTypes(typing: TargetTyping): Promise<string> {
        const {data} = await this.client.execute(generateTypingMutation, {
            workspaceId: typing.workspaceId,
            payload: {
                target: typing.target as any,
                components: typing.components,
                slots: typing.slots,
            },
        });

        return data.generateTyping;
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

const slotStaticContentQuery = graphql(`
    query SlotStaticContent(
        $organizationSlug: ReadableId!, 
        $workspaceSlug: ReadableId!, 
        $slotSlug: ReadableId!
        $majorVersion: Int
    ) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                slot(customId: $slotSlug) {
                    staticContent(majorVersion: $majorVersion) {
                        locale
                        content
                    }
                }
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
                                componentDefinition {
                                    resolvedDefinition
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`);

const componentQuery = graphql(`
    query Components($organizationSlug: ReadableId!, $workspaceSlug: ReadableId!) {
        organization(slug: $organizationSlug) {
            workspace(slug: $workspaceSlug) {
                components(first: 100) {
                    edges {
                        node {
                            id
                            customId
                            name
                            definition {
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

const generateTypingMutation = graphql(`
    mutation GenerateTyping($workspaceId: WorkspaceId!, $payload: GenerateTypingPayload!) {
        generateTyping(workspaceId: $workspaceId, payload: $payload)
    }
`);
