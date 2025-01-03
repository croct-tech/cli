import {Content} from '@croct/content-model/content/content';
import {
    AudienceDefinition,
    ComponentDefinition,
    ExperienceDefinition,
    SlotDefinition,
    Template,
} from '@/application/template/template';
import {LocalizedContentMap, PersonalizedContent, SlotContentMap} from '@/application/model/experience';

export type Refactoring = {
    componentMapping: Record<string, string>,
    slotMapping: Record<string, string>,
    audienceMapping: Record<string, string>,
    localeMapping: Record<string, string|null>,
    maximumAudiencePerExperience: number,
    isDynamicContentSupported: boolean,
};

export class TemplateRefactor {
    private readonly refactoring: Refactoring;

    public constructor(refactoring: Refactoring) {
        this.refactoring = refactoring;
    }

    public refactor(template: Template): Template {
        return {
            components: template.components?.map(component => this.refactorComponent(component)) ?? [],
            slots: template.slots?.map(slot => this.refactorSlot(slot)) ?? [],
            audiences: template.audiences?.map(audience => this.refactorAudience(audience)) ?? [],
            experiences: template.experiences?.map(experience => this.refactorExperience(experience)) ?? [],
        };
    }

    private refactorComponent(component: ComponentDefinition): ComponentDefinition {
        return {
            ...component,
            slug: this.refactoring.componentMapping[component.slug] ?? component.slug,
        };
    }

    private refactorSlot(slot: SlotDefinition): SlotDefinition {
        return {
            ...slot,
            slug: this.refactoring.slotMapping[slot.slug] ?? slot.slug,
            component: this.refactoring.componentMapping[slot.component] ?? slot.component,
        };
    }

    private refactorAudience(audience: AudienceDefinition): AudienceDefinition {
        return {
            ...audience,
            slug: this.refactoring.audienceMapping[audience.slug] ?? audience.slug,
        };
    }

    private refactorExperience(experience: ExperienceDefinition): ExperienceDefinition {
        return {
            ...experience,
            audiences: experience.audiences.map(audience => this.refactoring.audienceMapping[audience] ?? audience),
            slots: experience.slots.map(slot => this.refactoring.slotMapping[slot] ?? slot),
            content: this.refactorPersonalizedContent(
                experience.content,
                experience.audiences.slice(0, this.refactoring.maximumAudiencePerExperience),
            ),
        };
    }

    private refactorPersonalizedContent(content: PersonalizedContent, audiences: string[]): PersonalizedContent {
        return {
            default: this.refactorSlotContentMap(content.default),
            segmented: content.segmented.flatMap(segmentedContent => {
                const filteredAudiences = segmentedContent.audiences.filter(slug => audiences.includes(slug));

                if (filteredAudiences.length === 0) {
                    return [];
                }

                return {
                    audiences: filteredAudiences,
                    content: this.refactorSlotContentMap(segmentedContent.content),
                };
            }),
        };
    }

    private refactorSlotContentMap(content: SlotContentMap): SlotContentMap {
        return Object.fromEntries(
            Object.entries(content).map(
                ([slot, localizedContent]) => [
                    this.refactoring.slotMapping[slot] ?? slot,
                    this.refactorLocalizedContentMap(localizedContent),
                ],
            ),
        );
    }

    private refactorLocalizedContentMap(contentMap: LocalizedContentMap): LocalizedContentMap {
        return Object.fromEntries(
            Object.entries(contentMap).flatMap(
                ([locale, content]) => {
                    const mappedLocale = this.refactoring.localeMapping[locale];

                    if (mappedLocale === null) {
                        return [];
                    }

                    return [[mappedLocale ?? locale, this.refactorContent(content)]];
                },
            ),
        );
    }

    private refactorContent<T extends Content>(content: T): T {
        if (this.refactoring.isDynamicContentSupported) {
            return content;
        }

        switch (content.type) {
            case 'boolean':
            case 'text':
            case 'number':
                return content.value.type === 'static'
                    ? content
                    : {
                        ...content,
                        value: {
                            type: 'static',
                            value: content.value.default,
                        },
                    };

            case 'structure':
                return {
                    ...content,
                    attributes: Object.fromEntries(
                        Object.entries(content.attributes).map(
                            ([attributeName, attributeContent]) => [
                                attributeName,
                                this.refactorContent(attributeContent),
                            ],
                        ),
                    ),
                };

            case 'list':
                return {
                    ...content,
                    items: content.items.map(itemContent => this.refactorContent(itemContent)),
                };
        }
    }
}
