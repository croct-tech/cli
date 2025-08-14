import {Content} from '@croct/content-model/content/content';
import {randomUUID} from 'crypto';
import {GraphqlClient} from '@/infrastructure/graphql';
import {
    ApplicationPath,
    AudiencePath,
    ComponentCriteria,
    ExperienceCriteria,
    ExperiencePath,
    NewApplication,
    NewResourceIds,
    NewResources,
    PersonalizedContentDefinition,
    SlotCriteria,
    SlotPath,
    TargetSdk,
    TargetTyping,
    WorkspaceApi,
} from '@/application/api/workspace';
import {generateAvailableSlug} from '@/infrastructure/application/api/utils/generateAvailableSlug';
import {WorkspacePath} from '@/application/api/organization';
import {
    ApplicationQuery,
    AudienceQuery,
    ComponentQuery,
    CreateWorkspaceResourcePayload,
    ExperienceQuery,
    ExperiencesQuery,
    Feature,
    Platform as GraphqlPlatform,
    SlotQuery,
    WorkspaceResourceContentInput,
    WorkspaceResourcesExperienceContentInput,
    ApplicationEnvironment as GraphqlApplicationEnvironment,
    ApplicationTrafficStatus as GraphqlApplicationTrafficStatus,
    TargetSdk as GraphqlTargetSdk,
    ExperimentStatus as GraphqlExperimentStatus,
    ExperienceStatus as GraphqlExperienceStatus,
} from '@/infrastructure/graphql/schema/graphql';
import {audienceQuery, audiencesQuery} from '@/infrastructure/application/api/graphql/queries/audience';
import {slotQuery, slotsQuery, slotStaticContentQuery} from '@/infrastructure/application/api/graphql/queries/slot';
import {
    applicationQuery,
    applicationSlugAvailabilityQuery,
    applicationsQuery,
    createApplicationMutation,
} from '@/infrastructure/application/api/graphql/queries/application';
import {componentQuery, componentsQuery} from '@/infrastructure/application/api/graphql/queries/component';
import {experienceQuery, experiencesQuery} from '@/infrastructure/application/api/graphql/queries/experience';
import {generateTypingMutation} from '@/infrastructure/application/api/graphql/queries/typing';
import {Application, ApplicationEnvironment, ApplicationTrafficStatus} from '@/application/model/application';
import {Audience} from '@/application/model/audience';
import {Slot} from '@/application/model/slot';
import {Component} from '@/application/model/component';
import {
    ExperienceDetails,
    Experience,
    LocalizedContent,
    SlotContentMap,
    Variant,
    ExperienceStatus,
    ExperimentStatus,
} from '@/application/model/experience';
import {WorkspaceFeatures} from '@/application/model/workspace';
import {
    createResourcesMutation,
    workspaceFeaturesQuery,
} from '@/infrastructure/application/api/graphql/queries/workspace';
import {Platform} from '@/application/model/platform';
import {HierarchyResolver} from '@/infrastructure/application/api/graphql/hierarchyResolver';

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

type NormalizationMap<M extends string, A extends string> = {
    model: Record<M, A>,
    api: Record<A, M>,
};

function createNormalizationMap<M extends string, A extends string>(map: Record<M, A>): NormalizationMap<M, A> {
    return {
        model: map,
        api: Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key])),
    };
}

const platformMap = createNormalizationMap<Platform, GraphqlPlatform>({
    [Platform.JAVASCRIPT]: GraphqlPlatform.Javascript,
    [Platform.REACT]: GraphqlPlatform.React,
    [Platform.NEXTJS]: GraphqlPlatform.Next,
});

const environmentMap = createNormalizationMap<ApplicationEnvironment, GraphqlApplicationEnvironment>({
    [ApplicationEnvironment.DEVELOPMENT]: GraphqlApplicationEnvironment.Development,
    [ApplicationEnvironment.PRODUCTION]: GraphqlApplicationEnvironment.Production,
});

const trafficStatusMap = createNormalizationMap<ApplicationTrafficStatus, GraphqlApplicationTrafficStatus>({
    [ApplicationTrafficStatus.NEVER_RECEIVED_TRAFFIC]: GraphqlApplicationTrafficStatus.NeverReceivedTraffic,
    [ApplicationTrafficStatus.NOT_RECEIVING_TRAFFIC]: GraphqlApplicationTrafficStatus.NotReceivingTraffic,
    [ApplicationTrafficStatus.RECEIVING_TRAFFIC]: GraphqlApplicationTrafficStatus.ReceivingTraffic,
});

const targetSdkMap = createNormalizationMap<TargetSdk, GraphqlTargetSdk>({
    [TargetSdk.JAVASCRIPT]: GraphqlTargetSdk.PlugJs,
});

const experienceStatusMap = createNormalizationMap<ExperienceStatus, GraphqlExperienceStatus>({
    [ExperienceStatus.DRAFT]: GraphqlExperienceStatus.Draft,
    [ExperienceStatus.ACTIVE]: GraphqlExperienceStatus.Active,
    [ExperienceStatus.SCHEDULED]: GraphqlExperienceStatus.Scheduled,
    [ExperienceStatus.PAUSED]: GraphqlExperienceStatus.Paused,
    [ExperienceStatus.ARCHIVED]: GraphqlExperienceStatus.Archived,
});

const experimentStatusMap = createNormalizationMap<ExperimentStatus, GraphqlExperimentStatus>({
    [ExperimentStatus.DRAFT]: GraphqlExperimentStatus.Draft,
    [ExperimentStatus.ACTIVE]: GraphqlExperimentStatus.Active,
    [ExperimentStatus.SCHEDULED]: GraphqlExperimentStatus.Scheduled,
    [ExperimentStatus.PAUSED]: GraphqlExperimentStatus.Paused,
    [ExperimentStatus.FINISHED]: GraphqlExperimentStatus.Finished,
    [ExperimentStatus.INDIRECTLY_PAUSED]: GraphqlExperimentStatus.IndirectlyPaused,
});

export class GraphqlWorkspaceApi implements WorkspaceApi {
    private readonly client: GraphqlClient;

    private readonly hierarchyResolver: HierarchyResolver;

    public constructor(client: GraphqlClient, hierarchyResolver: HierarchyResolver) {
        this.client = client;
        this.hierarchyResolver = hierarchyResolver;
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
                audiences: quotas.audience,
                remainingAudiences: quotas.remainingAudiences,
                components: quotas.component,
                remainingComponents: quotas.remainingComponents,
                slots: quotas.slot,
                remainingSlots: quotas.remainingSlots,
                experiences: quotas.experience,
                remainingExperiences: quotas.remainingExperiences,
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
            environment: environmentMap.api[data.environment],
            platform: platformMap.api[data.platform ?? GraphqlPlatform.Javascript],
            publicId: data.publicId,
            trafficStatus: trafficStatusMap.api[data.applicationStatus],
            ...(logo !== null ? {logo: logo} : {}),
        };
    }

    public async createApplication(application: NewApplication): Promise<Application> {
        const hierarchy = await this.hierarchyResolver.getHierarchy({
            organizationSlug: application.organizationSlug,
            workspaceSlug: application.workspaceSlug,
        });

        const {data} = await this.client.execute(createApplicationMutation, {
            workspaceId: hierarchy.workspaceId,
            payload: {
                name: application.name,
                website: application.website,
                environment: environmentMap.model[application.environment],
                platform: platformMap.model[application.platform],
                timeZone: application.timeZone,
                slug: await this.generateApplicationSlug(
                    hierarchy.workspaceId,
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
            environment: environmentMap.api[node.environment],
            platform: platformMap.api[node.platform ?? GraphqlPlatform.Javascript],
            publicId: node.publicId,
            trafficStatus: trafficStatusMap.api[node.applicationStatus],
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

        const description = data.description ?? null;

        return {
            id: data.id,
            name: data.name,
            slug: data.customId,
            ...(description !== null ? {description: description} : {}),
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
            content: Object.fromEntries(
                data.content.default.map(
                    ({locale, content}) => [locale, content as Content<'structure'>],
                ),
            ),
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
                content: content.content as Content<'structure'>,
            }),
        );
    }

    public async generateTypes(target: TargetTyping): Promise<string> {
        const hierarchy = await this.hierarchyResolver.getHierarchy({
            organizationSlug: target.organizationSlug,
            workspaceSlug: target.workspaceSlug,
        });

        const {data} = await this.client.execute(generateTypingMutation, {
            workspaceId: hierarchy.workspaceId,
            payload: {
                target: targetSdkMap.model[target.target],
                components: target.components,
                slots: target.slots,
            },
        });

        return data.generateTyping;
    }

    public async getExperiences(path: ExperienceCriteria): Promise<Experience[]> {
        const {data} = await this.client.execute(experiencesQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
            status: path.status === undefined
                ? undefined
                : (Array.isArray(path.status) ? path.status : [path.status]).map(
                    status => experienceStatusMap.model[status],
                ),
        });

        const edges = data.organization?.workspace?.experiences.edges ?? [];

        return edges.flatMap((edge): Experience[] => {
            const node = edge?.node ?? null;

            if (node === null) {
                return [];
            }

            return [GraphqlWorkspaceApi.normalizeExperience(node)];
        });
    }

    public async getExperience(path: ExperiencePath): Promise<ExperienceDetails|null> {
        const {data} = await this.client.execute(experienceQuery, {
            organizationSlug: path.organizationSlug,
            workspaceSlug: path.workspaceSlug,
            experienceId: path.experienceId,
        });

        const node = data.organization?.workspace?.experience ?? null;

        if (node === null) {
            return null;
        }

        return GraphqlWorkspaceApi.normalizeExperienceDetails(node);
    }

    private static normalizeExperience(data: ExperienceSummaryData): Experience {
        const audiences = data.settings?.audiences ?? data.draft?.audiences ?? [];
        const slots = data.settings?.slots ?? data.draft?.slots ?? [];
        const experiment = data.currentExperiment?.name ?? data.draft?.experiment?.name ?? null;

        return {
            id: data.id,
            name: data.name,
            priority: data.priority ?? data.draft?.priority ?? 0,
            status: experienceStatusMap.api[data.status],
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

    private static normalizeExperienceDetails(data: ExperienceData): ExperienceDetails {
        const audiences = data.settings?.audiences ?? data.draft?.audiences ?? [];
        const slots = data.settings?.slots ?? data.draft?.slots ?? [];
        const experiment = data.currentExperiment ?? data.draft?.experiment ?? null;
        const {name = null, goalId = null, crossDevice = null, traffic = null} = experiment ?? {};
        const slotMap: Record<string, string> = Object.fromEntries(
            slots.flatMap(
                ({slot = null}) => (slot === null ? [] : [[slot.id, slot.customId]]),
            ),
        );

        return {
            id: data.id,
            name: data.name,
            priority: data.priority ?? data.draft?.priority ?? 0,
            status: experienceStatusMap.api[data.status],
            hasExperiments: data.hasExperiments,
            audiences: audiences.map(audience => audience.customId),
            slots: Object.values(slotMap),
            ...(experiment !== null
                ? {
                    experiment: {
                        ...(name !== null ? {name: name} : {}),
                        ...(goalId !== null ? {goalId: goalId} : {}),
                        ...(crossDevice !== null ? {crossDevice: crossDevice} : {}),
                        ...(traffic !== null ? {traffic: traffic} : {}),
                        ...('status' in experiment ? {status: experimentStatusMap.api[experiment.status]} : {}),
                        variants: (experiment.variants ?? []).map(
                            (variant): Variant => {
                                const id = variant.variantId;
                                const variantName = variant.name ?? null;
                                const allocation = variant.allocation ?? null;

                                return {
                                    ...(id !== null ? {id: id} : {}),
                                    ...(variantName !== null ? {name: variantName} : {}),
                                    ...(allocation !== null ? {allocation: allocation} : {}),
                                    baseline: variant.baseline === true,
                                    content: {
                                        default: GraphqlWorkspaceApi.normalizeLocalizedContent(
                                            variant.content?.default.contents ?? [],
                                            slotMap,
                                        ),
                                        segmented: (variant.content?.segmented ?? []).map(
                                            content => ({
                                                id: content.groupId,
                                                audiences: content.audiences.map(audience => audience.audienceId),
                                                content: GraphqlWorkspaceApi.normalizeLocalizedContent(
                                                    content.contents,
                                                    slotMap,
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
                    slotMap,
                ),
                segmented: (data.settings?.content.segmented ?? data.draft?.content?.segmented ?? []).map(
                    content => ({
                        id: content.groupId,
                        audiences: content.audiences.map(
                            ({audienceId}) => audiences.find(({id}) => id === audienceId)?.customId ?? audienceId,
                        ),
                        content: GraphqlWorkspaceApi.normalizeLocalizedContent(content.contents, slotMap),
                    }),
                ),
            },
        };
    }

    private static normalizeLocalizedContent(
        data: LocalizedContentData,
        slotMap: Record<string, string>,
    ): SlotContentMap {
        const slotContentMap: SlotContentMap = {};

        for (const content of data) {
            const {locale, slotId} = content;
            const slug = slotMap[slotId];

            if (slug === undefined) {
                continue;
            }

            if (slotContentMap[slug] === undefined) {
                slotContentMap[slug] = {};
            }

            slotContentMap[slug][locale] = content.content as Content<'structure'>;
        }

        return slotContentMap;
    }

    public async createResources(resources: NewResources): Promise<NewResourceIds> {
        const hierarchy = await this.hierarchyResolver.getHierarchy({
            organizationSlug: resources.organizationSlug,
            workspaceSlug: resources.workspaceSlug,
        });

        const payload: CreateWorkspaceResourcePayload = {
            components: Object.entries(resources.components ?? {}).map(
                ([slug, definition]) => ({
                    customId: slug,
                    name: definition.name,
                    description: definition.description,
                    definition: definition.schema,
                }),
            ),
            slots: Object.entries(resources.slots ?? {}).map(
                ([slug, definition]) => ({
                    customId: slug,
                    name: definition.name,
                    component: definition.component,
                    defaultContent: Object.entries(definition.content).map(
                        ([locale, content]) => ({
                            locale: locale,
                            content: content,
                        }),
                    ),
                }),
            ),
            audiences: Object.entries(resources.audiences ?? {}).map(
                ([slug, definition]) => ({
                    customId: slug,
                    name: definition.name,
                    criteria: definition.criteria,
                }),
            ),
            experiences: (resources.experiences ?? []).map(experience => {
                const experiment = experience.experiment ?? null;

                return {
                    name: experience.name,
                    audiences: experience.audiences,
                    slots: experience.slots,
                    experiment: experiment !== null
                        ? {
                            name: experiment.name,
                            goalId: experiment.goalId,
                            traffic: experiment.traffic,
                            crossDevice: experiment.crossDevice === true,
                            variants: experiment.variants.map(
                                variant => ({
                                    id: randomUUID(),
                                    name: variant.name ?? '',
                                    baseline: variant.baseline === true,
                                    allocation: variant.allocation ?? 0,
                                    content: GraphqlWorkspaceApi.createContentVariantGroup(variant.content),
                                }),
                            ),
                        }
                        : undefined,
                    content: GraphqlWorkspaceApi.createContentVariantGroup(experience.content),
                    validate: true,
                    publish: experience.draft !== true,
                };
            }),
        };

        const {data: {createWorkspaceResources: result}} = await this.client.execute(createResourcesMutation, {
            workspaceId: hierarchy.workspaceId,
            payload: payload,
        });

        return {
            components: Object.fromEntries(
                payload.components.map(
                    ({customId}, index) => [customId, result.components[index]],
                ),
            ),
            slots: Object.fromEntries(
                payload.slots.map(
                    ({customId}, index) => [customId, result.slots[index]],
                ),
            ),
            audiences: Object.fromEntries(
                payload.audiences.map(
                    ({customId}, index) => [customId, result.audiences[index]],
                ),
            ),
            experiences: result.experiences.map<NewResourceIds['experiences'][number]>(
                experience => {
                    const experimentId = experience.experimentId ?? null;

                    return {
                        experienceId: experience.id,
                        ...(experimentId !== null ? {experimentId: experimentId} : {}),
                    };
                },
            ),
        };
    }

    private static createContentVariantGroup(
        content: PersonalizedContentDefinition,
    ): WorkspaceResourcesExperienceContentInput {
        return {
            default: {
                id: randomUUID(),
                contents: GraphqlWorkspaceApi.createSlotContentMap(content.default ?? {}),
            },
            segmented: (content.segmented ?? []).map(
                segmentedContent => ({
                    id: randomUUID(),
                    audiences: segmentedContent.audiences,
                    contents: GraphqlWorkspaceApi.createSlotContentMap(segmentedContent.content),
                }),
            ),
        };
    }

    private static createSlotContentMap(contentMap: SlotContentMap): WorkspaceResourceContentInput[] {
        return Object.entries(contentMap).flatMap(
            ([slot, localizedContent]) => Object.entries(localizedContent).map<WorkspaceResourceContentInput>(
                ([locale, content]) => ({
                    slot: slot,
                    locale: locale,
                    content: content,
                }),
            ),
        );
    }

    private generateApplicationSlug(
        workspaceId: string,
        baseName: string,
        environment: ApplicationEnvironment,
    ): Promise<string> {
        return generateAvailableSlug({
            query: applicationSlugAvailabilityQuery,
            baseName: `${baseName} ${environment === ApplicationEnvironment.DEVELOPMENT ? 'dev' : 'prod'}`,
            client: this.client,
            variables: {
                workspaceId: workspaceId,
            },
        });
    }
}
