import {Action} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {
    AudienceDefinition,
    ComponentDefinition,
    ExperienceDefinition,
    NewResourceIds,
    SlotDefinition,
    WorkspaceApi,
} from '@/application/api/workspace';
import {WorkspaceResources, ResourcesAnalysis} from '@/application/template/resources';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {OrganizationApi} from '@/application/api/organization';
import {Workspace, WorkspaceFeatures} from '@/application/model/workspace';
import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import {Form} from '@/application/cli/form/form';
import {SlugMappingOptions, SlugMapping} from '@/application/cli/form/workspace/slugMappingForm';
import {ResourceMatches, ResourceMatcher} from '@/application/template/resourceMatcher';
import {UserApi} from '@/application/api/user';
import {ResourceRefactor} from '@/application/template/resourceRefactor';
import {HelpfulError, ErrorReason} from '@/application/error';

export type CreateResourceOptions = {
    resources: WorkspaceResources,
    result?: NewResourceVariables,
};

type VersionedResourceInfo = {
    id?: string,
    version?: string,
};

type NewResourceVariables = {
    audiences?: Record<string, string>,
    components?: Record<string, VersionedResourceInfo>,
    slots?: Record<string, VersionedResourceInfo>,
    experiences?: Record<number, string>,
    experiments?: Record<number, string>,
};

export type Configuration = {
    configurationManager: ConfigurationManager,
    mappingForm: Form<SlugMapping, SlugMappingOptions>,
    matcher: ResourceMatcher,
    api: {
        user: UserApi,
        organization: OrganizationApi,
        workspace: WorkspaceApi,
    },
};

type MissingResources = {
    components: Set<string>,
    slots: Set<string>,
    audiences: Set<string>,
    locales: Set<string>,
};

type ProjectInfo = {
    configuration: ProjectConfiguration,
    workspace: Workspace & WorkspaceFeatures,
};

type RequiredQuota = {
    components: number,
    slots: number,
    audiences: number,
    experiences: number,
    experiments: number,
};

export type ResourceCreationPlan = {
    resources: WorkspaceResources,
    matches: ResourceMatches,
    mapping: SlugMapping,
};

export class CreateResourceAction implements Action<CreateResourceOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: CreateResourceOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Analyzing resources');
        const analysis = WorkspaceResources.analyze(options.resources);
        const {configurationManager, api: {workspace: api}} = this.config;
        const configuration = await configurationManager.load();
        const projectInfo = await this.getProjectInfo(configuration);

        await this.checkMissingResources(
            // Omit locales from the analysis since content in unsupported locales
            // are mapped to the default locale, otherwise it would throw an error.
            {...analysis, locales: new Set()},
            options.resources,
            projectInfo,
        );

        const plan = await this.createPlan(options.resources, analysis, projectInfo);

        notifier?.update('Creating resources');

        const newResources = await api.createResources({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            ...plan.resources,
        });

        notifier?.stop();

        if (output !== undefined) {
            const warnings = CreateResourceAction.getWarnings(analysis, projectInfo.workspace);

            if (warnings.length > 0) {
                for (const warning of warnings) {
                    output.warn(`${warning}`);
                }
            }
        }

        if (options.result !== undefined) {
            CreateResourceAction.setVariables(options.result, plan, newResources, context);
        }
    }

    private async createPlan(
        resources: WorkspaceResources,
        analysis: ResourcesAnalysis,
        projectInfo: ProjectInfo,
    ): Promise<ResourceCreationPlan> {
        const {mappingForm, matcher} = this.config;

        const matches = await matcher.match({
            resources: resources,
            workspaceSlug: projectInfo.configuration.workspace,
            organizationSlug: projectInfo.configuration.organization,
        });

        const newAudiences = Object.entries(matches.audiences).filter(
            (entry): entry is [string, AudienceDefinition] => !('id' in entry[1]),
        );

        const newComponents = Object.entries(matches.components).filter(
            (entry): entry is [string, ComponentDefinition] => !('id' in entry[1]),
        );

        const newSlots = Object.entries(matches.slots).filter(
            (entry): entry is [string, SlotDefinition] => !('id' in entry[1]),
        );

        const newExperiences = matches.experiences.filter(
            (experience): experience is ExperienceDefinition => !('id' in experience),
        );

        const newExperiments = newExperiences.flatMap(
            experience => (experience.experiment === undefined ? [] : [experience.experiment]),
        );

        await this.checkRequiredQuota(projectInfo, {
            components: newComponents.length,
            slots: newSlots.length,
            audiences: newAudiences.length,
            experiences: newExperiences.length,
            experiments: newExperiments.length,
        });

        const mapping = await mappingForm.handle({
            organizationSlug: projectInfo.configuration.organization,
            workspaceSlug: projectInfo.configuration.workspace,
            resources: {
                audiences: newAudiences.map(([slug]) => slug),
                components: newComponents.map(([slug]) => slug),
                slots: newSlots.map(([slug]) => slug),
            },
        });

        const localeMapping: Record<string, string> = {};
        const {workspace} = projectInfo;

        for (const locale of analysis.locales) {
            if (!workspace.locales.includes(locale)) {
                localeMapping[locale] = workspace.defaultLocale;
            }
        }

        return {
            matches: matches,
            mapping: mapping,
            resources: new ResourceRefactor({
                componentMapping: mapping.components,
                audienceMapping: mapping.audiences,
                slotMapping: mapping.slots,
                dynamicAttributesPerContent: workspace.quotas.dynamicAttributesPerContent,
                maximumAudiencePerExperience: workspace.quotas.audiencesPerExperience,
                isCrossDeviceFeatureEnabled: workspace.features.crossDevice,
                localeMapping: localeMapping,
            }).refactor({
                components: Object.fromEntries(newComponents),
                slots: Object.fromEntries(newSlots),
                audiences: Object.fromEntries(newAudiences),
                experiences: newExperiences,
            }),
        };
    }

    private async getProjectInfo(configuration: ProjectConfiguration): Promise<ProjectInfo> {
        const {api} = this.config;

        const [workspace, features] = await Promise.all([
            api.organization.getWorkspace({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
            }),
            api.workspace.getFeatures({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
            }),
        ]);

        if (workspace == null || features == null) {
            throw new HelpfulError('Workspace not found', {
                title: 'Invalid configuration',
                reason: ErrorReason.INVALID_CONFIGURATION,
                details: [
                    'The workspace defined in the configuration does not exist',
                ],
                suggestions: [
                    'Check the configuration file',
                ],
            });
        }

        return {
            configuration: configuration,
            workspace: {
                ...workspace,
                ...features,
            },
        };
    }

    private async checkRequiredQuota(projectInfo: ProjectInfo, required: RequiredQuota): Promise<void> {
        const {api: {user: api}} = this.config;

        for (const [resource, count] of Object.entries(required) as Array<[keyof RequiredQuota, number]>) {
            const remainingQuota = CreateResourceAction.getRemainingQuota(projectInfo.workspace, resource);

            if (remainingQuota < count) {
                const email = await api.getUser()
                    .catch(() => ({email: undefined}));

                const link = new URL('https://croct.com/contact/support');

                link.searchParams.set('subject', 'limit-increase');
                link.searchParams.set('organization', projectInfo.configuration.organization);
                link.searchParams.set('message', `I need more quota for ${resource}`);

                if (email.email !== undefined) {
                    link.searchParams.set('email', email.email);
                }

                throw new HelpfulError(
                    `Not enough ${resource} quota available in your workspace.`,
                    {
                        title: 'Insufficient quota',
                        reason: ErrorReason.PRECONDITION,
                        links: [
                            {
                                label: 'Request more quota',
                                url: link.toString(),
                            },
                        ],
                        details: [
                            `Available: ${remainingQuota}`,
                            `Required: ${count}`,
                        ],
                        suggestions: [
                            `Free up quota by removing unused ${resource}`,
                            'Request additional quota from support',
                        ],
                    },
                );
            }
        }
    }

    private async checkMissingResources(
        analysis: ResourcesAnalysis,
        resources: WorkspaceResources,
        projectInfo: ProjectInfo,
    ): Promise<void> {
        const missingResources = await this.findMissingResources(analysis, resources, projectInfo);

        for (const [resource, missing] of Object.entries(missingResources)) {
            if (missing.size > 0) {
                throw new HelpfulError(`Some ${resource} referenced in the template are missing`, {
                    title: 'Invalid template',
                    reason: ErrorReason.INVALID_INPUT,
                    details: [
                        `Missing ${resource}: ${Array.from(missing).join(', ')}`,
                    ],
                    suggestions: [
                        'Report this issue to the template author',
                    ],
                });
            }
        }
    }

    private async findMissingResources(
        analysis: ResourcesAnalysis,
        resources: WorkspaceResources,
        projectInfo: ProjectInfo,
    ): Promise<MissingResources> {
        const missingComponents = new Set(analysis.components);
        const missingSlots = new Set(analysis.slots);
        const missingAudiences = new Set(analysis.audiences);
        const missingLocales = new Set(analysis.locales);

        for (const slug of Object.keys(resources.components ?? {})) {
            missingComponents.delete(slug);
        }

        for (const slug of Object.keys(resources.slots ?? {})) {
            missingSlots.delete(slug);
        }

        for (const slug of Object.keys(resources.audiences ?? {})) {
            missingAudiences.delete(slug);
        }

        const {api} = this.config;

        await Promise.all([
            ...[...missingComponents].map(
                async id => {
                    const component = api.workspace.getComponent({
                        organizationSlug: projectInfo.configuration.organization,
                        workspaceSlug: projectInfo.configuration.workspace,
                        componentSlug: id,
                    });

                    if ((await component) !== null) {
                        missingComponents.delete(id);
                    }
                },
            ),
            ...[...missingSlots].map(
                async id => {
                    const slot = api.workspace.getSlot({
                        organizationSlug: projectInfo.configuration.organization,
                        workspaceSlug: projectInfo.configuration.workspace,
                        slotSlug: id,
                    });

                    if ((await slot) !== null) {
                        missingSlots.delete(id);
                    }
                },
            ),
            ...[...missingAudiences].map(
                async id => {
                    const audience = api.workspace.getAudience({
                        organizationSlug: projectInfo.configuration.organization,
                        workspaceSlug: projectInfo.configuration.workspace,
                        audienceSlug: id,
                    });

                    if ((await audience) !== null) {
                        missingAudiences.delete(id);
                    }
                },
            ),
            (async (): Promise<void> => {
                if (missingLocales.size === 0) {
                    return;
                }

                const workspace = await api.organization.getWorkspace({
                    organizationSlug: projectInfo.configuration.organization,
                    workspaceSlug: projectInfo.configuration.workspace,
                });

                for (const locale of workspace?.locales ?? []) {
                    missingLocales.delete(locale);
                }
            })(),
        ]);

        return {
            components: missingComponents,
            slots: missingSlots,
            audiences: missingAudiences,
            locales: missingLocales,
        };
    }

    private static getRemainingQuota<T extends keyof RequiredQuota>(features: WorkspaceFeatures, resource: T): number {
        const resourceName = (resource.charAt(0).toUpperCase() + resource.slice(1)) as Capitalize<T>;

        return features.quotas[`remaining${resourceName}`];
    }

    private static getWarnings(analysis: ResourcesAnalysis, workspace: ProjectInfo['workspace']): string[] {
        const warnings: string[] = [];

        const maxDynamicAttributes = Math.max(
            ...analysis.experiences.map(experience => experience.dynamicContentPerContent),
        );

        if (maxDynamicAttributes > workspace.quotas.dynamicAttributesPerContent) {
            warnings.push('Some dynamic values have been removed from the content to fit the workspace quota');
        }

        const maxAudiences = Math.max(
            ...analysis.experiences.map(experience => experience.audiencesPerExperience),
        );

        if (maxAudiences > workspace.quotas.audiencesPerExperience) {
            warnings.push('Some audiences have been removed from the experiences to fit the workspace quota');
        }

        const missingLocales = Array.from(analysis.locales)
            .filter(locale => !workspace.locales.includes(locale));

        if (missingLocales.length > 0) {
            warnings.push('Content in unsupported locales have been mapped to default or dropped');
        }

        if (!workspace.features.crossDevice && analysis.experiences.some(experience => experience.crossDevice)) {
            warnings.push('Cross-device experiments have been disabled ');
        }

        return warnings;
    }

    private static setVariables(
        variables: NewResourceVariables,
        processedTemplate: ResourceCreationPlan,
        newResources: NewResourceIds,
        context: ActionContext,
    ): void {
        if (variables.audiences !== undefined) {
            for (const [slug] of Object.entries(processedTemplate.matches.audiences ?? {})) {
                if (variables.audiences[slug] !== undefined) {
                    context.set(variables.audiences[slug], processedTemplate.mapping.audiences[slug] ?? slug);
                }
            }
        }

        if (variables.components !== undefined) {
            for (const [slug] of Object.entries(processedTemplate.matches.components ?? {})) {
                const componentVariables = variables.components[slug];

                if (componentVariables !== undefined) {
                    const matchedSlug = processedTemplate.mapping.components[slug] ?? slug;
                    const matchedResource = processedTemplate.matches.components[slug] ?? {};

                    if (componentVariables.id !== undefined) {
                        context.set(componentVariables.id, matchedSlug);
                    }

                    if (componentVariables.version !== undefined) {
                        context.set(
                            componentVariables.version,
                            'version' in matchedResource ? matchedResource.version.major : 1,
                        );
                    }
                }
            }
        }

        if (variables.slots !== undefined) {
            for (const [slug] of Object.entries(processedTemplate.matches.slots ?? {})) {
                const slotVariables = variables.slots[slug];

                if (slotVariables !== undefined) {
                    const matchedSlug = processedTemplate.mapping.slots[slug] ?? slug;
                    const matchedResource = processedTemplate.matches.slots[slug] ?? {};

                    if (slotVariables.id !== undefined) {
                        context.set(slotVariables.id, matchedSlug);
                    }

                    if (slotVariables.version !== undefined) {
                        context.set(
                            slotVariables.version,
                            'version' in matchedResource ? matchedResource.version.major : 1,
                        );
                    }
                }
            }
        }

        const {experiences} = processedTemplate.matches;

        let newIndex = 0;

        for (const [index, experience] of experiences.entries()) {
            if (variables.experiences?.[index] !== undefined) {
                context.set(
                    variables.experiences[index],
                    'id' in experience && experience.id !== undefined
                        ? experience.id
                        : newResources.experiences[newIndex].experienceId,
                );
            }

            if (variables.experiments?.[index] !== undefined) {
                const {experiment} = experience;

                const experimentId = experiment !== undefined && 'id' in experiment && experiment.id !== undefined
                    ? experiment.id
                    : newResources.experiences[newIndex].experimentId;

                if (experimentId !== undefined) {
                    context.set(variables.experiments[index], experimentId);
                }
            }

            if (!('id' in experience) || experience.id === undefined) {
                newIndex++;
            }
        }
    }
}
