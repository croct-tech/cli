import {deepEqual} from 'fast-equals';
import {Audience} from '@/application/model/audience';
import {Slot} from '@/application/model/slot';
import {Component} from '@/application/model/component';
import {
    AudienceDefinition,
    ComponentDefinition,
    ExperienceDefinition,
    PersonalizedContentDefinition,
    SlotDefinition,
    VariantDefinition,
    WorkspaceApi,
} from '@/application/api/workspace';
import {ExperienceDetails, ExperienceStatus, Experience, SlotContentMap} from '@/application/model/experience';
import {WorkspacePath} from '@/application/api/organization';
import {WorkspaceResources} from '@/application/template/resources';

export type Configuration = {
    workspaceApi: WorkspaceApi,
};

export type ResourceMatches = {
    slots: Record<string, SlotDefinition|Slot>,
    components: Record<string, ComponentDefinition|Component>,
    audiences: Record<string, AudienceDefinition|Audience>,
    experiences: Array<ExperienceDefinition|Experience>,
};

export type TargetWorkspaceResources = WorkspacePath & {
    resources: WorkspaceResources,
};

type LazyExperience = Experience & {
    details: {
        content: Promise<ExperienceDetails['content'] | null>,
        experiment: Promise<ExperienceDetails['experiment'] | null>,
    },
};

export class ResourceMatcher {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async match(target: TargetWorkspaceResources): Promise<ResourceMatches> {
        const {resources, ...path} = target;
        const [components, slots, audiences, experiences] = await Promise.all([
            this.mapComponents(resources.components ?? {}, path),
            this.mapSlots(resources.slots ?? {}, path),
            this.mapAudiences(resources.audiences ?? {}, path),
            this.mapExperiences(resources.experiences ?? [], path),
        ]);

        return {
            components: components,
            slots: slots,
            audiences: audiences,
            experiences: experiences,
        };
    }

    private async mapAudiences(
        definitions: Record<string, AudienceDefinition>,
        path: WorkspacePath,
    ): Promise<Record<string, Audience|AudienceDefinition>> {
        const {workspaceApi: api} = this.config;

        const audiences = await Promise.all(
            Object.keys(definitions).map<Promise<[string, Audience | null]>>(
                async slug => [slug, await api.getAudience({
                    ...path,
                    audienceSlug: slug,
                })],
            ),
        );

        const map: Record<string, Audience|AudienceDefinition> = {};

        for (const [slug, audience] of audiences) {
            map[slug] = audience === null || !ResourceMatcher.isSimilarAudience(definitions[slug], audience)
                ? definitions[slug]
                : audience;
        }

        return map;
    }

    private async mapComponents(
        definitions: Record<string, ComponentDefinition>,
        path: WorkspacePath,
    ): Promise<Record<string, Component|ComponentDefinition>> {
        const {workspaceApi: api} = this.config;
        const components = await Promise.all(
            Object.keys(definitions).map<Promise<[string, Component | null]>>(
                async slug => [slug, await api.getComponent({
                    ...path,
                    componentSlug: slug,
                })],
            ),
        );

        const map: Record<string, Component|ComponentDefinition> = {};

        for (const [slug, component] of components) {
            map[slug] = component === null || !ResourceMatcher.isSimilarComponent(definitions[slug], component)
                ? definitions[slug]
                : component;
        }

        return map;
    }

    private async mapSlots(
        definitions: Record<string, SlotDefinition>,
        path: WorkspacePath,
    ): Promise<Record<string, Slot|SlotDefinition>> {
        const {workspaceApi: api} = this.config;

        const slots = await Promise.all(
            Object.keys(definitions).map<Promise<[string, Slot | null]>>(
                async slug => [slug, await api.getSlot({
                    ...path,
                    slotSlug: slug,
                })],
            ),
        );

        const map: Record<string, Slot|SlotDefinition> = {};

        for (const [slug, slot] of slots) {
            map[slug] = slot === null || !ResourceMatcher.isSimilarSlot(definitions[slug], slot)
                ? definitions[slug]
                : slot;
        }

        return map;
    }

    private async mapExperiences(
        definitions: ExperienceDefinition[],
        path: WorkspacePath,
    ): Promise<Array<Experience|ExperienceDefinition>> {
        const {workspaceApi: api} = this.config;

        const summaries = await api.getExperiences({
            ...path,
            status: [
                ExperienceStatus.ACTIVE,
                ExperienceStatus.PAUSED,
                ExperienceStatus.DRAFT,
            ],
        });

        const experiences = summaries.map<LazyExperience>(summary => {
            let promise: Promise<ExperienceDetails | null> | null = null;

            function loadExperience(): Promise<ExperienceDetails | null> {
                if (promise === null) {
                    promise = api.getExperience({
                        ...path,
                        experienceId: summary.id,
                    });
                }

                return promise;
            }

            return {
                ...summary,
                details: {
                    get content(): Promise<ExperienceDetails['content'] | null> {
                        return loadExperience().then(experience => experience?.content ?? null);
                    },
                    get experiment(): Promise<ExperienceDetails['experiment'] | null> {
                        return loadExperience().then(experience => experience?.experiment ?? null);
                    },
                },
            };
        });

        return Promise.all(
            definitions.map(async definition => {
                for (const experience of experiences) {
                    if (await this.matchesExperience(definition, experience)) {
                        const {details: _, ...summary} = experience;

                        return summary;
                    }
                }

                return definition;
            }),
        );
    }

    private async matchesExperience(definition: ExperienceDefinition, experience: LazyExperience): Promise<boolean> {
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
                || !ResourceMatcher.isSimilarExperimentContent(definition.experiment.variants, experiment.variants)
            )
        ) {
            return false;
        }

        return ResourceMatcher.isSimilarPersonalizedContent(
            definition.content,
            content ?? {default: {}, segmented: []},
        );
    }

    private static isSimilarAudience(definition: AudienceDefinition, audience: Audience): boolean {
        return definition.criteria === audience.criteria;
    }

    private static isSimilarComponent(definition: ComponentDefinition, component: Component): boolean {
        return deepEqual(definition.schema, component.definition);
    }

    private static isSimilarSlot(definition: SlotDefinition, slug: Slot): boolean {
        return definition.component === slug.component?.slug
            && Object.values(definition.content)
                .some(content => Object.values(slug.content).some(otherContent => deepEqual(content, otherContent)));
    }

    private static isSimilarExperimentContent(left: VariantDefinition[], right: VariantDefinition[]): boolean {
        if (left.length !== right.length) {
            return false;
        }

        return left.some((variant, index) => deepEqual(variant, right[index]));
    }

    private static isSimilarPersonalizedContent(
        left: PersonalizedContentDefinition,
        right: PersonalizedContentDefinition,
    ): boolean {
        if (ResourceMatcher.isSimilarSlotContent(left.default ?? {}, right.default ?? {})) {
            return true;
        }

        for (const segmentedContent of left.segmented ?? []) {
            for (const otherSegmentedContent of right.segmented ?? []) {
                if (
                    deepEqual(segmentedContent.audiences, otherSegmentedContent.audiences)
                    && ResourceMatcher.isSimilarSlotContent(segmentedContent.content, otherSegmentedContent.content)
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    private static isSimilarSlotContent(left: SlotContentMap, right: SlotContentMap): boolean {
        for (const [slotId, localizedContent] of Object.entries(left)) {
            const otherLocalizedContent = right[slotId];

            if (otherLocalizedContent === undefined) {
                continue;
            }

            for (const content of Object.values(localizedContent)) {
                if (Object.values(otherLocalizedContent).some(otherContent => deepEqual(content, otherContent))) {
                    return true;
                }
            }
        }

        return false;
    }
}
