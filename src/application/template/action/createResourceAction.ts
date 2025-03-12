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
import {ResolvedConfiguration} from '@/application/project/configuration/projectConfiguration';
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

type NewResourceVariables = {
    audiences?: Record<string, string>,
    components?: Record<string, string>,
    slots?: Record<string, string>,
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
    configuration: ResolvedConfiguration,
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

        this.checkMissingResources({...analysis, locales: new Set()}, options.resources);

        const {configurationManager, api: {workspace: api}} = this.config;

        const configuration = await configurationManager.resolve();
        const projectInfo = await this.getProjectInfo(configuration);

        const plan = await this.createPlan(options.resources, analysis, projectInfo);

        notifier?.update('Creating resources');

        const newResources = await api.createResources({
            organizationId: configuration.organizationId,
            workspaceId: configuration.workspaceId,
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

    private async getProjectInfo(configuration: ResolvedConfiguration): Promise<ProjectInfo> {
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

    private checkMissingResources(analysis: ResourcesAnalysis, resources: WorkspaceResources): void {
        const missingResources = this.findMissingResources(analysis, resources);

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

    private findMissingResources(analysis: ResourcesAnalysis, resources: WorkspaceResources): MissingResources {
        const components = new Set(analysis.components);
        const slots = new Set(analysis.slots);
        const audiences = new Set(analysis.audiences);
        const locales = new Set(analysis.locales);

        for (const slug of Object.keys(resources.components ?? {})) {
            components.delete(slug);
        }

        for (const slug of Object.keys(resources.slots ?? {})) {
            slots.delete(slug);
        }

        for (const slug of Object.keys(resources.audiences ?? {})) {
            audiences.delete(slug);
        }

        return {
            components: components,
            slots: slots,
            audiences: audiences,
            locales: locales,
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
            warnings.push('Content in unsupported locales have been mapped to default or removed');
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
                if (variables.components[slug] !== undefined) {
                    context.set(variables.components[slug], processedTemplate.mapping.components[slug] ?? slug);
                }
            }
        }

        if (variables.slots !== undefined) {
            for (const [slug] of Object.entries(processedTemplate.matches.slots ?? {})) {
                if (variables.slots[slug] !== undefined) {
                    context.set(variables.slots[slug], processedTemplate.mapping.slots[slug] ?? slug);
                }
            }
        }

        if (variables.experiences !== undefined) {
            const {experiences} = processedTemplate.matches;

            let newIndex = 0;

            for (const [index, experience] of experiences.entries()) {
                if (variables.experiences[index] !== undefined) {
                    context.set(
                        variables.experiences[index],
                        'id' in experience
                            ? experience.id
                            : newResources.experiences[newIndex].experienceId,
                    );
                }

                const experienceId = experience.experiment !== undefined && 'id' in experience.experiment
                    ? experience.experiment.id
                    : newResources.experiences[newIndex].experimentId;

                if (experienceId !== undefined && variables.experiments?.[index] !== undefined) {
                    context.set(variables.experiments[index], experienceId);
                }

                if (!('id' in experience)) {
                    newIndex++;
                }
            }
        }
    }
}
