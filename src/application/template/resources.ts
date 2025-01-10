/* eslint-disable no-inner-declarations -- False positive */
import {Content} from '@croct/content-model/content/content';
import {PersonalizedContent} from '@/application/model/experience';
import {ExperienceDefinition, NewResources} from '@/application/api/workspace';

export type WorkspaceResources = Omit<NewResources, 'organizationId' | 'workspaceId'>;

type ContentResources = {
    slots: Set<string>,
    audiences: Set<string>,
    locales: Set<string>,
    audiencesPerExperience: number,
    dynamicContentPerContent: number,
};

type ExperienceResources = ContentResources & {
    name: string,
    crossDevice: boolean,
};

export type ResourcesAnalysis = {
    components: Set<string>,
    slots: Set<string>,
    audiences: Set<string>,
    locales: Set<string>,
    experiences: ExperienceResources[],
};

export namespace WorkspaceResources {
    export function analyze(resources: WorkspaceResources): ResourcesAnalysis {
        const referencedComponents = new Set(Object.values(resources.slots ?? {}).map(slot => slot.component) ?? []);
        const referencedSlots = new Set(resources.experiences?.flatMap(experience => experience.slots) ?? []);
        const referencedAudiences = new Set(resources.experiences?.flatMap(experience => experience.audiences) ?? []);

        const experienceResources = (resources.experiences ?? []).map<ExperienceResources>(
            experience => ({
                name: experience.name,
                maximumAudiencesPerExperience: experience.audiences.length,
                crossDevice: experience.experiment?.crossDevice === true,
                ...getExperienceResources(experience),
            }),
        );

        const locales = new Set<string>();

        for (const slot of Object.values(resources.slots ?? {})) {
            for (const locale of Object.keys(slot.content)) {
                locales.add(locale);
            }
        }

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

        let dynamicAttributePerContent = 0;

        for (const [slotSlug, contentMap] of Object.entries(content.default)) {
            referencedSlots.add(slotSlug);

            for (const [locale, slotContent] of Object.entries(contentMap)) {
                locales.add(locale);

                dynamicAttributePerContent = Math.max(dynamicAttributePerContent, countDynamicContent(slotContent));
            }
        }

        const referencedAudiences = new Set<string>();

        let audiencesPerExperience = 0;

        for (const segmentedContent of content.segmented) {
            for (const audience of segmentedContent.audiences) {
                referencedAudiences.add(audience);
            }

            audiencesPerExperience = Math.max(audiencesPerExperience, segmentedContent.audiences.length);

            for (const [slotSlug, contentMap] of Object.entries(segmentedContent.content)) {
                referencedSlots.add(slotSlug);

                for (const [locale, slotContent] of Object.entries(contentMap)) {
                    locales.add(locale);

                    dynamicAttributePerContent = Math.max(dynamicAttributePerContent, countDynamicContent(slotContent));
                }
            }
        }

        return {
            slots: referencedSlots,
            audiences: referencedAudiences,
            locales: locales,
            audiencesPerExperience: audiencesPerExperience,
            dynamicContentPerContent: dynamicAttributePerContent,
        };
    }

    function countDynamicContent(content: Content): number {
        switch (content.type) {
            case 'boolean':
            case 'text':
            case 'number':
                return content.value.type === 'dynamic' ? 1 : 0;

            case 'structure':
                return Object.values(content.attributes)
                    .map(countDynamicContent)
                    .reduce((total, increment) => total + increment, 0);

            case 'list':
                return content.items
                    .map(countDynamicContent)
                    .reduce((total, increment) => total + increment, 0);
        }
    }
}
