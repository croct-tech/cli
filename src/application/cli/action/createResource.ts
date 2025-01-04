import {deepEqual} from 'fast-equals';
import {Action} from '@/application/cli/action/action';
import {ActionContext} from '@/application/cli/action/context';
import {WorkspaceApi} from '@/application/api/workspace';
import {
    AudienceDefinition,
    ComponentDefinition,
    ExperienceDefinition,
    SlotDefinition,
    Template,
    TemplateAnalysis,
} from '@/application/template/template';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {OrganizationApi} from '@/application/api/organization';
import {CliError, CliErrorCode} from '@/application/cli/error';
import {Workspace, WorkspaceFeatures} from '@/application/model/workspace';
import {ResolvedConfiguration} from '@/application/project/configuration/configuration';
import {Slot} from '@/application/model/slot';
import {Component} from '@/application/model/component';
import {Audience} from '@/application/model/audience';
import {Experience, ExperienceStatus, ExperienceSummary} from '@/application/model/experience';

export type CreateResourceOptions = Template;

export type Configuration = {
    configurationManager: ConfigurationManager,
    api: {
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

type WorkspaceInfo = Workspace & {
    features: WorkspaceFeatures,
};

type LazyExperience = ExperienceSummary & {
    details: {
        content: Promise<Experience['content'] | null>,
        experiment: Promise<Experience['experiment'] | null>,
    },
};

export class CreateResource implements Action<CreateResourceOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async execute(options: CreateResourceOptions, context: ActionContext): Promise<void> {
        const analysis = Template.analyze(options);

        this.checkMissingResources(analysis, options);

        const {configurationManager} = this.config;
        const configuration = await configurationManager.resolve();

        const template = await this.updateTemplate(options, analysis, configuration);
    }

    private async updateTemplate(
        template: Template,
        analysis: TemplateAnalysis,
        configuration: ResolvedConfiguration,
        context: ActionContext,
    ): Promise<Template> {
        const {input} = context;

        if (input === undefined) {
            throw new CliError(
                'Some resource IDs in the template require manual resolution '
                + 'which is not supported in non-interactive mode',
                {
                    code: CliErrorCode.PRECONDITION,
                    suggestions: [
                        'Re-run the command without the `--quiet` and `--non-interactive` options',
                    ],
                },
            );
        }

        const api = this.config.api.workspace;
        const newSlots = Object.keys(template.slots ?? {});
        const newComponents = Object.keys(template.components ?? {});
        const newAudiences = Object.keys(template.audiences ?? {});

        const [slots, components, audiences] = await Promise.all([
            newSlots.length > 0
                ? api.getSlots({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                })
                : new Array<Slot>(),
            newComponents.length > 0
                ? api.getComponents({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                })
                : new Array<Component>(),
            newAudiences.length > 0
                ? api.getAudiences({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                })
                : new Array<Audience>(),
        ]);

        const conflictingSlots = newSlots.filter(
            slot => slots.some(existing => existing.slug === slot),
        );

        const conflictingComponents = newComponents.filter(
            component => components.some(existing => existing.slug === component),
        );

        const conflictingAudiences = newAudiences.filter(
            audience => audiences.some(existing => existing.slug === audience),
        );

        const slotMapping: Record<string, string> = {};
        const componentMapping: Record<string, string> = {};
        const audienceMapping: Record<string, string> = {};

        for (const slot of conflictingSlots) {
        }
    }

    private async syncTemplate(template: Template, configuration: ResolvedConfiguration): Promise<Template> {
        const [components, slots, audiences, experiences] = await Promise.all([
            this.getNewComponents(template.components ?? {}, configuration),
            this.getNewSlots(template.slots ?? {}, configuration),
            this.getNewAudiences(template.audiences ?? {}, configuration),
            this.getNewExperiences(template.experiences ?? [], configuration),
        ]);

        return {
            components: components,
            slots: slots,
            audiences: audiences,
            experiences: experiences,
        };
    }

    private async getNewExperiences(
        definitions: ExperienceDefinition[],
        configuration: ResolvedConfiguration,
    ): Promise<ExperienceDefinition[]> {
        const {api: {workspace: api}} = this.config;

        const summaries = await api.getExperiences({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            status: [
                ExperienceStatus.ACTIVE,
                ExperienceStatus.PAUSED,
                ExperienceStatus.DRAFT,
            ],
        });

        const experiences = summaries.map<LazyExperience>(summary => {
            let promise: Promise<Experience | null> | null = null;

            function loadExperience(): Promise<Experience | null> {
                if (promise === null) {
                    promise = api.getExperience({
                        organizationSlug: configuration.organization,
                        workspaceSlug: configuration.workspace,
                        experienceId: summary.id,
                    });
                }

                return promise;
            }

            return {
                ...summary,
                details: {
                    get content(): Promise<Experience['content'] | null> {
                        return loadExperience().then(experience => experience?.content ?? null);
                    },
                    get experiment(): Promise<Experience['experiment'] | null> {
                        return loadExperience().then(experience => experience?.experiment ?? null);
                    },
                },
            };
        });

        const newExperiences = await Promise.all(
            definitions.map(async definition => {
                for (const experience of experiences) {
                    if (await this.isSameExperience(definition, experience)) {
                        return null;
                    }
                }

                return definition;
            }),
        );

        return newExperiences.filter(experience => experience !== null);
    }

    private async isSameExperience(definition: ExperienceDefinition, experience: LazyExperience): Promise<boolean> {
        const experienceStatus = definition.draft === true ? ExperienceStatus.DRAFT : ExperienceStatus.ACTIVE;

        if (
            experienceStatus !== experience.status
            || !deepEqual(definition.audiences, experience.audiences)
            || !deepEqual(definition.slots, experience.slots)
            || (definition.experiment !== undefined && experience.experiment === undefined)
        ) {
            return false;
        }

        const [content, experiment = null] = await Promise.all([
            experience.details.content,
            experience.details.experiment,
        ]);

        if (
            definition.experiment !== undefined
            && (
                experiment === null
                || definition.experiment.goalId !== experiment.goalId
                || definition.experiment.traffic !== experiment.traffic
                || definition.experiment.crossDevice !== experiment.crossDevice
                || !deepEqual(definition.experiment.variants, experiment.variants)
            )
        ) {
            return false;
        }

        return deepEqual(definition.content, content);
    }

    private async getNewAudiences(
        definitions: Record<string, AudienceDefinition>,
        configuration: ResolvedConfiguration,
    ): Promise<Record<string, AudienceDefinition>> {
        const {api: {workspace: api}} = this.config;
        const audiences = await Promise.all(
            Object.keys(definitions).map<Promise<[string, Audience | null]>>(
                async slug => [slug, await api.getAudience({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                    audienceSlug: slug,
                })],
            ),
        );

        const newAudiences: Record<string, AudienceDefinition> = {};

        for (const [slug, audience] of audiences) {
            if (audience === null || !CreateResource.isSameAudience(definitions[slug], audience)) {
                newAudiences[slug] = definitions[slug];
            }
        }

        return newAudiences;
    }

    private static isSameAudience(definition: AudienceDefinition, audience: Audience): boolean {
        return definition.criteria === audience.criteria;
    }

    private async getNewComponents(
        definitions: Record<string, ComponentDefinition>,
        configuration: ResolvedConfiguration,
    ): Promise<Record<string, ComponentDefinition>> {
        const {api: {workspace: api}} = this.config;
        const components = await Promise.all(
            Object.keys(definitions).map<Promise<[string, Component | null]>>(
                async slug => [slug, await api.getComponent({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                    componentSlug: slug,
                })],
            ),
        );

        const newComponents: Record<string, ComponentDefinition> = {};

        for (const [slug, component] of components) {
            if (component === null || !CreateResource.isSameComponent(definitions[slug], component)) {
                newComponents[slug] = definitions[slug];
            }
        }

        return newComponents;
    }

    private static isSameComponent(definition: ComponentDefinition, component: Component): boolean {
        return deepEqual(definition.definition, component.definition);
    }

    private async getNewSlots(
        definitions: Record<string, SlotDefinition>,
        configuration: ResolvedConfiguration,
    ): Promise<Record<string, SlotDefinition>> {
        const {api: {workspace: api}} = this.config;
        const slots = await Promise.all(
            Object.keys(definitions).map<Promise<[string, Slot | null]>>(
                async slug => [slug, await api.getSlot({
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                    slotSlug: slug,
                })],
            ),
        );

        const newSlots: Record<string, SlotDefinition> = {};

        for (const [slug, slot] of slots) {
            if (slot === null || !CreateResource.isSameSlot(definitions[slug], slot)) {
                newSlots[slug] = definitions[slug];
            }
        }

        return newSlots;
    }

    private static isSameSlot(definition: SlotDefinition, slot: Slot): boolean {
        return definition.component === slot.component?.slug;
    }

    private async getWorkspace(configuration: ResolvedConfiguration): Promise<WorkspaceInfo> {
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
            throw new CliError('Workspace not found', {
                title: 'Invalid configuration',
                code: CliErrorCode.INVALID_CONFIGURATION,
                details: [
                    'The workspace defined in the configuration does not exist',
                ],
                suggestions: [
                    'Check the configuration file',
                ],
            });
        }

        return {
            ...workspace,
            features: features,
        };
    }

    private checkMissingResources(analysis: TemplateAnalysis, template: Template): void {
        const missingResources = this.findMissingResources(analysis, template);

        for (const [resource, missing] of Object.entries(missingResources)) {
            if (missing.size > 0) {
                // Add link to report issue to the template author
                throw new CliError(`Some ${resource} referenced in the template are missing`, {
                    title: 'Invalid template',
                    code: CliErrorCode.INVALID_INPUT,
                    details: [...missingResources.components],
                    suggestions: [
                        'Report this issue to the template author',
                    ],
                });
            }
        }
    }

    private findMissingResources(analysis: TemplateAnalysis, template: Template): MissingResources {
        const components = new Set(analysis.components);
        const slots = new Set(analysis.slots);
        const audiences = new Set(analysis.audiences);
        const locales = new Set(analysis.locales);

        for (const slug of Object.keys(template.components ?? {})) {
            components.delete(slug);
        }

        for (const slug of Object.keys(template.slots ?? {})) {
            slots.delete(slug);
        }

        for (const slug of Object.keys(template.audiences ?? {})) {
            audiences.delete(slug);
        }

        return {
            components: components,
            slots: slots,
            audiences: audiences,
            locales: locales,
        };
    }
}

declare module '@/application/cli/action/action' {
    export interface ActionOptionsMap {
        'create-resource': CreateResourceOptions;
    }
}
