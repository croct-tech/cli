/* eslint-disable no-inner-declarations -- False positive */
import {RootDefinition} from '@croct/content-model/definition/definition';
import {Content} from '@croct/content-model/content/content';
import {PersonalizedContent} from '@/application/model/experience';

export type SlotDefinition = {
    slug: string,
    name: string,
    component: string,
};

export type ComponentDefinition = {
    slug: string,
    name: string,
    definition: RootDefinition,
};

export type AudienceDefinition = {
    slug: string,
    name: string,
    criteria: string,
};

export type ExperienceDefinition = {
    name: string,
    priority?: number,
    draft?: boolean,
    audiences: string[],
    slots: string[],
    experiment?: {
        name?: string,
        goalId?: string,
        crossDevice?: boolean,
        traffic?: number,
        variants: Array<{
            name?: string,
            content: PersonalizedContent,
        }>,
    },
    content: PersonalizedContent,
};

export type Template = {
    components?: ComponentDefinition[],
    slots?: SlotDefinition[],
    audiences?: AudienceDefinition[],
    experiences?: ExperienceDefinition[],
};

type ContentResources = {
    slots: Set<string>,
    audiences: Set<string>,
    locales: Set<string>,
    dynamicContent: boolean,
};

type ExperienceResources = ContentResources & {
    name: string,
    crossDevice: boolean,
};

export type TemplateAnalysis = {
    components: Set<string>,
    slots: Set<string>,
    audiences: Set<string>,
    locales: Set<string>,
    experiences: ExperienceResources[],
};

export namespace Template {
    export function analyze(template: Template): TemplateAnalysis {
        const referencedComponents = new Set(template.slots?.flatMap(slot => slot.component) ?? []);
        const referencedSlots = new Set(template.experiences?.flatMap(experience => experience.slots) ?? []);
        const referencedAudiences = new Set(template.experiences?.flatMap(experience => experience.audiences) ?? []);

        const experienceResources = (template.experiences ?? []).map<ExperienceResources>(
            experience => ({
                name: experience.name,
                maximumAudiencesPerExperience: experience.audiences.length,
                crossDevice: experience.experiment?.crossDevice === true,
                ...getExperienceResources(experience),
            }),
        );

        const locales = new Set<string>();

        for (const experience of experienceResources) {
            for (const locale of experience.locales) {
                locales.add(locale);
            }

            for (const audienceSlug of experience.audiences) {
                referencedAudiences.add(audienceSlug);
            }

            for (const slotSlug of experience.slots) {
                referencedSlots.add(slotSlug);
            }
        }

        return {
            components: referencedComponents,
            slots: referencedSlots,
            audiences: referencedAudiences,
            locales: locales,
            experiences: experienceResources,
        };
    }

    function getExperienceResources(experience: ExperienceDefinition): ContentResources {
        const references = getContentResources(experience.content);

        for (const variant of experience.experiment?.variants ?? []) {
            const resources = getContentResources(variant.content);

            resources.audiences.forEach(audience => references.audiences.add(audience));
            resources.slots.forEach(audience => references.slots.add(audience));
        }

        return {
            ...references,
        };
    }

    function getContentResources(content: PersonalizedContent): ContentResources {
        const referencedSlots = new Set<string>();
        const locales = new Set<string>();

        let dynamicContent = false;

        for (const [slotSlug, contentMap] of Object.entries(content.default)) {
            referencedSlots.add(slotSlug);

            for (const [locale, slotContent] of Object.entries(contentMap)) {
                locales.add(locale);
                dynamicContent = dynamicContent || hasDynamicContent(slotContent);
            }
        }

        const referencedAudiences = new Set<string>();

        for (const segmentedContent of content.segmented) {
            for (const audience of segmentedContent.audiences) {
                referencedAudiences.add(audience);
            }

            for (const [slotSlug, contentMap] of Object.entries(segmentedContent.content)) {
                referencedSlots.add(slotSlug);

                for (const [locale, slotContent] of Object.entries(contentMap)) {
                    locales.add(locale);
                    dynamicContent = dynamicContent || hasDynamicContent(slotContent);
                }
            }
        }

        return {
            slots: referencedSlots,
            audiences: referencedAudiences,
            locales: locales,
            dynamicContent: dynamicContent,
        };
    }

    function hasDynamicContent(content: Content): boolean {
        switch (content.type) {
            case 'boolean':
            case 'text':
            case 'number':
                return content.value.type === 'dynamic';

            case 'structure':
                return Object.values(content.attributes).some(hasDynamicContent);

            case 'list':
                return content.items.some(hasDynamicContent);
        }
    }
}
