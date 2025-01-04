import {GraphqlClient} from '@/infrastructure/graphql';
import {
    ApplicationPath,
    AudiencePath,
    ComponentCriteria,
    ExperienceCriteria,
    ExperiencePath,
    NewApplication,
    SlotCriteria,
    SlotPath,
    TargetTyping,
    WorkspaceApi,
} from '@/application/api/workspace';
import {generateAvailableSlug} from '@/infrastructure/application/api/utils/generateAvailableSlug';
import {WorkspacePath} from '@/application/api/organization';
import {
    ApplicationQuery,
    AudienceQuery,
    ComponentQuery,
    ExperienceQuery,
    ExperiencesQuery,
    ExperienceStatus,
    Feature,
    SlotQuery,
} from '@/infrastructure/graphql/schema/graphql';
import {audienceQuery, audiencesQuery} from '@/infrastructure/application/api/graphql/queries/audience';
import {slotQuery, slotsQuery, slotStaticContentQuery} from '@/infrastructure/application/api/graphql/queries/slot';
import {
    applicationQuery,
    applicationSlugQuery,
    applicationsQuery,
    createApplicationMutation,
} from '@/infrastructure/application/api/graphql/queries/application';
import {componentQuery, componentsQuery} from '@/infrastructure/application/api/graphql/queries/component';
import {experienceQuery, experiencesQuery} from '@/infrastructure/application/api/graphql/queries/experience';
import {generateTypingMutation} from '@/infrastructure/application/api/graphql/queries/typing';
import {Application, ApplicationEnvironment} from '@/application/model/application';
import {Audience} from '@/application/model/audience';
import {Slot} from '@/application/model/slot';
import {Component} from '@/application/model/component';
import {Experience, ExperienceSummary, LocalizedContent, SlotContentMap} from '@/application/model/experience';
import {WorkspaceFeatures} from '@/application/model/workspace';
import {workspaceFeaturesQuery} from '@/infrastructure/application/api/graphql/queries/workspace';

type ApplicationData = NonNullable<
    NonNullable<NonNullable<ApplicationQuery['organization']>['workspace']>['application']
>;

type AudienceData = NonNullable<NonNullable<NonNullable<AudienceQuery['organization']>['workspace']>['audience']>;

type SlotData = NonNullable<
    NonNullable<NonNullable<SlotQuery['organization']>['workspace']>['slot']
>;

type ComponentData = NonNullable<
    NonNullable<NonNullable<ComponentQuery['organization']>['workspace']>['component']
>;

type ExperienceData = NonNullable<
    NonNullable<NonNullable<ExperienceQuery['organization']>['workspace']>['experience']
>;

type ExperienceSummaryData = NonNullable<
    NonNullable<
        NonNullable<
            NonNullable<
                NonNullable<ExperiencesQuery['organization']
            >['workspace']
        >['experiences']['edges']>[0]
    >['node']
>;

type LocalizedContentData = NonNullable<
    NonNullable<
        NonNullable<
            NonNullable<
                NonNullable<ExperienceQuery['organization']>['workspace']
            >['experience']
        >['settings']
    >['content']
>['default']['contents'];

export class GraphqlWorkspaceApi implements WorkspaceApi {
    private readonly client: GraphqlClient;

    public constructor(client: GraphqlClient) {
        this.client = client;
    }

    public async getFeatures(path: WorkspacePath): Promise<WorkspaceFeatures|null> {
        const {data} = await this.client.execute(workspaceFeaturesQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
        });

        const workspace = data.organization?.workspace ?? null;

        if (workspace === null) {
            return null;
        }

        const {quotas, capabilities: {features}} = workspace;

        return {
            quotas: {
                audience: quotas.audience,
                remainingAudiences: quotas.remainingAudiences,
                component: quotas.component,
                remainingComponents: quotas.remainingComponents,
                slot: quotas.slot,
                remainingSlots: quotas.remainingSlots,
                experience: quotas.experience,
                remainingExperiences: quotas.remainingExperiences,
                experiment: quotas.experiment,
                remainingExperiments: quotas.remainingExperiments,
                dynamicAttributesPerContent: quotas.dynamicAttributesPerContent,
                audiencesPerExperience: quotas.audiencesPerExperience,
            },
            features: {
                crossDevice: features.includes(Feature.CrossDeviceExperiment),
                dataExport: features.includes(Feature.ApiDataExport),
            },
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

            return [GraphqlWorkspaceApi.normalizeApplication(node)];
        });
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

        return GraphqlWorkspaceApi.normalizeApplication(node);
    }

    private static normalizeApplication(data: ApplicationData): Application {
        const {logo = null} = data;

        return {
            id: data.id,
            name: data.name,
            slug: data.slug,
            timeZone: data.settings.timeZone,
            website: data.website,
            environment: data.environment as any,
            platform: data.platform as any,
            publicId: data.publicId,
            trafficStatus: data.applicationStatus as any,
            ...(logo !== null ? {logo: logo} : {}),
        };
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

    public async getAudiences(path: WorkspacePath): Promise<Audience[]> {
        const {data} = await this.client.execute(audiencesQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
        });

        const edges = data.organization?.workspace?.audiences.edges ?? [];

        return edges.flatMap((edge): Audience[] => {
            const node = edge?.node ?? null;

            if (node === null) {
                return [];
            }

            return [GraphqlWorkspaceApi.normalizeAudience(node)];
        });
    }

    public async getAudience(path: AudiencePath): Promise<Audience|null> {
        const {data} = await this.client.execute(audienceQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
            audienceSlug: path.audienceSlug,
        });

        const node = data.organization?.workspace?.audience ?? null;

        if (node === null) {
            return null;
        }

        return GraphqlWorkspaceApi.normalizeAudience(node);
    }

    private static normalizeAudience(data: AudienceData): Audience {
        return {
            id: data.id,
            name: data.name,
            slug: data.customId,
            criteria: data.criteria,
        };
    }

    public async getComponents(path: WorkspacePath): Promise<Component[]> {
        const {data} = await this.client.execute(componentsQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
        });

        const edges = data.organization?.workspace?.components.edges ?? [];

        return edges.flatMap((edge): Component[] => {
            const node = edge?.node ?? null;

            if (node === null) {
                return [];
            }

            return [GraphqlWorkspaceApi.normalizeComponent(node)];
        });
    }

    public async getComponent(criteria: ComponentCriteria): Promise<Component|null> {
        const {data} = await this.client.execute(componentQuery, {
            organizationSlug: criteria.organizationSlug,
            workspaceSlug: criteria.workspaceSlug,
            componentSlug: criteria.componentSlug,
            majorVersion: criteria.majorVersion,
        });

        const node = data.organization?.workspace?.component ?? null;

        if (node === null) {
            return null;
        }

        return GraphqlWorkspaceApi.normalizeComponent(node);
    }

    private static normalizeComponent(data: ComponentData): Component {
        const {
            definition,
            metadata: {directReferences, indirectReferences, referenceMetadata},
        } = data.definition;

        return {
            id: data.id,
            name: data.name,
            slug: data.customId,
            definition: definition,
            version: {
                major: data.definition.version.major,
                minor: data.definition.version.minor,
            },
            metadata: {
                directReferences: directReferences.map(
                    reference => referenceMetadata.find(
                        ({componentId}) => componentId === reference,
                    )?.referenceName ?? reference,
                ),
                indirectReferences: indirectReferences.map(
                    reference => referenceMetadata.find(
                        ({componentId}) => componentId === reference,
                    )?.referenceName ?? reference,
                ),
            },
        };
    }

    public async getSlots(path: WorkspacePath): Promise<Slot[]> {
        const {data} = await this.client.execute(slotsQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
        });

        const edges = data.organization?.workspace?.slots.edges ?? [];

        return edges.flatMap((edge): Slot[] => {
            const node = edge?.node ?? null;

            if (node === null) {
                return [];
            }

            return [GraphqlWorkspaceApi.normalizeSlot(node)];
        });
    }

    public async getSlot(criteria: SlotCriteria): Promise<Slot|null> {
        const {data} = await this.client.execute(slotQuery, {
            organizationSlug: criteria.organizationSlug,
            workspaceSlug: criteria.workspaceSlug,
            slotSlug: criteria.slotSlug,
            majorVersion: criteria.majorVersion,
        });

        const node = data.organization?.workspace?.slot ?? null;

        if (node === null) {
            return null;
        }

        return GraphqlWorkspaceApi.normalizeSlot(node);
    }

    private static normalizeSlot(data: SlotData): Slot {
        const {component = null} = data.content;
        const metadata = component?.definition.metadata ?? null;

        return {
            id: data.id,
            name: data.name,
            slug: data.customId,
            ...(
                component !== null && metadata !== null
                    ? {
                        component: {
                            slug: component.customId,
                            version: {
                                major: component.definition.version.major,
                                minor: component.definition.version.minor,
                            },
                            metadata: {
                                directReferences: metadata.directReferences.map(
                                    reference => metadata.referenceMetadata.find(
                                        ({componentId}) => componentId === reference,
                                    )?.referenceName ?? reference,
                                ),
                                indirectReferences: metadata.indirectReferences.map(
                                    reference => metadata.referenceMetadata.find(
                                        ({componentId}) => componentId === reference,
                                    )?.referenceName ?? reference,
                                ),
                            },
                        },
                    }
                    : {}
            ),
            version: {
                major: data.content.version.major,
                minor: data.content.version.minor,
            },
            resolvedDefinition: data.content.componentDefinition.resolvedDefinition,
        };
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

    public async getExperiences(path: ExperienceCriteria): Promise<ExperienceSummary[]> {
        const {data} = await this.client.execute(experiencesQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
            status: path.status as unknown as (ExperienceStatus | ExperienceStatus[]),
        });

        const edges = data.organization?.workspace?.experiences.edges ?? [];

        return edges.flatMap((edge): ExperienceSummary[] => {
            const node = edge?.node ?? null;

            if (node === null) {
                return [];
            }

            return [GraphqlWorkspaceApi.normalizeExperienceSummary(node)];
        });
    }

    public async getExperience(path: ExperiencePath): Promise<Experience|null> {
        const {data} = await this.client.execute(experienceQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
            experienceId: path.experienceId,
        });

        const node = data.organization?.workspace?.experience ?? null;

        if (node === null) {
            return null;
        }

        return GraphqlWorkspaceApi.normalizeExperience(node);
    }

    private static normalizeExperienceSummary(data: ExperienceSummaryData): ExperienceSummary {
        const audiences = data.settings?.audiences ?? data.draft?.audiences ?? [];
        const slots = data.settings?.slots ?? data.draft?.slots ?? [];
        const experiment = data.currentExperiment?.name ?? data.draft?.experiment?.name ?? null;

        return {
            id: data.id,
            name: data.name,
            priority: data.priority ?? data.draft?.priority ?? 0,
            status: data.status as any,
            audiences: audiences.map(audience => audience.customId),
            slots: slots.flatMap(({slot = null}) => (slot === null ? [] : [slot.customId])),
            ...(experiment !== null
                ? {
                    experiment: {
                        name: experiment,
                    },
                }
                : {}
            ),
        };
    }

    private static normalizeExperience(data: ExperienceData): Experience {
        const audiences = data.settings?.audiences ?? data.draft?.audiences ?? [];
        const slots = data.settings?.slots ?? data.draft?.slots ?? [];
        const experiment = data.currentExperiment ?? data.draft?.experiment ?? null;
        const {name = null, goalId = null, crossDevice = null, traffic = null} = experiment ?? {};

        return {
            id: data.id,
            name: data.name,
            priority: data.priority ?? data.draft?.priority ?? 0,
            status: data.status as any,
            hasExperiments: data.hasExperiments,
            audiences: audiences.map(audience => audience.customId),
            slots: slots.flatMap(({slot = null}) => (slot === null ? [] : [slot.customId])),
            ...(experiment !== null
                ? {
                    experiment: {
                        ...(name !== null ? {name: name} : {}),
                        ...(goalId !== null ? {goalId: goalId} : {}),
                        ...(crossDevice !== null ? {crossDevice: crossDevice} : {}),
                        ...(traffic !== null ? {traffic: traffic} : {}),
                        variants: (experiment.variants ?? []).map(
                            variant => {
                                const variantName = variant.name ?? null;

                                return {
                                    ...(variantName !== null ? {name: variantName} : {}),
                                    content: {
                                        default: GraphqlWorkspaceApi.normalizeLocalizedContent(
                                            variant.content?.default.contents ?? [],
                                        ),
                                        segmented: (variant.content?.segmented ?? []).map(
                                            content => ({
                                                groupId: content.groupId,
                                                audiences: content.audiences.map(audience => audience.audienceId),
                                                content: GraphqlWorkspaceApi.normalizeLocalizedContent(
                                                    content.contents,
                                                ),
                                            }),
                                        ),
                                    },
                                };
                            },
                        ),
                    },
                }
                : {}
            ),
            content: {
                default: GraphqlWorkspaceApi.normalizeLocalizedContent(
                    data.settings?.content.default.contents
                    ?? data.draft?.content?.default.contents
                    ?? [],
                ),
                segmented: (data.settings?.content.segmented ?? data.draft?.content?.segmented ?? []).map(
                    content => ({
                        groupId: content.groupId,
                        audiences: content.audiences.map(
                            ({audienceId}) => audiences.find(({id}) => id === audienceId)?.customId ?? audienceId,
                        ),
                        content: GraphqlWorkspaceApi.normalizeLocalizedContent(content.contents),
                    }),
                ),
            },
        };
    }

    private static normalizeLocalizedContent(data: LocalizedContentData): SlotContentMap {
        return Object.fromEntries(
            data.map(
                content => [content.slotId, Object.fromEntries(
                    Object.entries(content.content).map(
                        ([locale, localizedContent]) => [locale, localizedContent],
                    ),
                )],
            ),
        );
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
