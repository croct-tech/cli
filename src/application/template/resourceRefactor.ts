import {Content} from '@croct/content-model/content/content';
import {ContentDefinition, RootDefinition} from '@croct/content-model/definition/definition';
import {WorkspaceResources} from '@/application/template/resources';
import {LocalizedContentMap, SlotContentMap} from '@/application/model/experience';
import {
    AudienceDefinition,
    ComponentDefinition,
    ExperienceDefinition,
    PersonalizedContentDefinition,
    SlotDefinition,
} from '@/application/api/workspace';

export type Refactoring = {
    componentMapping: Record<string, string>,
    slotMapping: Record<string, string>,
    audienceMapping: Record<string, string>,
    localeMapping: Record<string, string|null>,
    maximumAudiencePerExperience: number,
    dynamicAttributesPerContent: number,
    isCrossDeviceFeatureEnabled: boolean,
};

type ContentQuota = {
    dynamicAttributesPerContent: number,
};

export class ResourceRefactor {
    private readonly refactoring: Refactoring;

    public constructor(refactoring: Refactoring) {
        this.refactoring = refactoring;
    }

    public refactor(template: WorkspaceResources): WorkspaceResources {
        return {
            components: Object.fromEntries(
                Object.entries(template.components ?? {}).map<[string, ComponentDefinition]>(
                    ([slug, component]) => [
                        this.refactoring.componentMapping[slug] ?? slug,
                        {
                            ...component,
                            schema: this.refactorSchema(component.schema) as RootDefinition,
                        },
                    ],
                ),
            ),
            slots: Object.fromEntries(
                Object.entries(template.slots ?? {}).map<[string, SlotDefinition]>(
                    ([slug, slot]) => [
                        this.refactoring.slotMapping[slug] ?? slug,
                        this.refactorSlotContent(slot),
                    ],
                ),
            ),
            audiences: Object.fromEntries(
                Object.entries(template.audiences ?? {}).map<[string, AudienceDefinition]>(
                    ([slug, audience]) => [
                        this.refactoring.audienceMapping[slug] ?? slug,
                        audience,
                    ],
                ),
            ),
            experiences: template.experiences?.map(experience => this.refactorExperience(experience)) ?? [],
        };
    }

    private refactorSchema(schema: ContentDefinition): ContentDefinition {
        switch (schema.type) {
            case 'boolean':
            case 'text':
            case 'number':
                return schema;

            case 'structure':
                return {
                    ...schema,
                    attributes: Object.fromEntries(
                        Object.entries(schema.attributes).map(
                            ([attributeName, attribute]) => [
                                attributeName,
                                {
                                    ...attribute,
                                    type: this.refactorSchema(attribute.type),
                                },
                            ],
                        ),
                    ),
                };

            case 'list':
                return {
                    ...schema,
                    items: this.refactorSchema(schema.items),
                };

            case 'union':
                return {
                    ...schema,
                    types: Object.fromEntries(
                        Object.entries(schema.types).map(
                            ([typeName, type]) => [
                                typeName,
                                this.refactorSchema(type) as ContentDefinition<'structure'|'reference'>,
                            ],
                        ),
                    ),
                };

            case 'reference':
                return {
                    ...schema,
                    id: this.refactoring.componentMapping[schema.id] ?? schema.id,
                };
        }
    }

    private refactorSlotContent(slot: SlotDefinition): SlotDefinition {
        return {
            ...slot,
            component: this.refactoring.componentMapping[slot.component] ?? slot.component,
            content: this.refactorLocalizedContentMap(slot.content),
        };
    }

    private refactorExperience(experience: ExperienceDefinition): ExperienceDefinition {
        const audiences = experience.audiences.slice(0, this.refactoring.maximumAudiencePerExperience);
        const {experiment} = experience;

        return {
            ...experience,
            audiences: experience.audiences.map(audience => this.refactoring.audienceMapping[audience] ?? audience),
            slots: experience.slots.map(slot => this.refactoring.slotMapping[slot] ?? slot),
            experiment: experiment !== undefined
                ? {
                    ...experiment,
                    variants: experiment.variants.map(
                        variant => ({
                            ...variant,
                            content: this.refactorPersonalizedContent(variant.content, audiences),
                        }),
                    ),
                    crossDevice: (experiment.crossDevice ?? false)
                        && this.refactoring.isCrossDeviceFeatureEnabled,
                }
                : undefined,
            content: this.refactorPersonalizedContent(experience.content, audiences),
        };
    }

    private refactorPersonalizedContent(
        content: PersonalizedContentDefinition,
        audiences: string[],
    ): PersonalizedContentDefinition {
        return {
            default: this.refactorSlotContentMap(content.default ?? {}),
            segmented: (content.segmented ?? []).flatMap(segmentedContent => {
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

                    if (
                        mappedLocale === null
                        // Avoid overwriting existing content
                        || (mappedLocale !== undefined && contentMap[mappedLocale] !== undefined)
                    ) {
                        return [];
                    }

                    return [[mappedLocale ?? locale, this.refactorContent(content, {
                        dynamicAttributesPerContent: this.refactoring.dynamicAttributesPerContent,
                    })]];
                },
            ),
        );
    }

    private refactorContent<T extends Content>(content: T, quota: ContentQuota): T {
        switch (content.type) {
            case 'boolean':
            case 'text':
            case 'number':
                if (content.value.type === 'dynamic' && quota.dynamicAttributesPerContent > 0) {
                    // eslint-disable-next-line no-param-reassign -- Must be mutated in place
                    quota.dynamicAttributesPerContent--;
                }

                return content.value.type === 'static' || quota.dynamicAttributesPerContent > 0
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
                                this.refactorContent(attributeContent, quota),
                            ],
                        ),
                    ),
                };

            case 'list':
                return {
                    ...content,
                    items: content.items.map(itemContent => this.refactorContent(itemContent, quota)),
                };
        }
    }
}
