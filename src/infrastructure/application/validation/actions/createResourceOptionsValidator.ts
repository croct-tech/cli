import {z, ZodType} from 'zod';
import {
    AttributeDefinition,
    ChoiceDefinition,
    ContentDefinition,
    RootDefinition,
} from '@croct/content-model/definition/definition';
import {Content, PrimitiveValue} from '@croct/content-model/content/content';
import {JsonValue} from '@croct/json';
import {CreateResourceOptions} from '@/application/template/action/createResourceAction';
import {
    AudienceDefinition,
    ComponentDefinition,
    ExperienceDefinition,
    PersonalizedContentDefinition,
    SegmentedContentDefinition,
    SlotDefinition,
    VariantDefinition,
} from '@/application/api/workspace';
import {LocalizedContentMap, SlotContentMap} from '@/application/model/experience';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const outputMapSchema = z.record(z.string().min(1), z.string().min(1));
const outputListSchema = z.record(z.number().nonnegative(), z.string().min(1));

const audienceDefinitionSchema: ZodType<AudienceDefinition> = z.object({
    name: z.string().min(1),
    criteria: z.string().min(1),
});

const definitionAnnotationSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
});

const booleanDefinitionSchema = definitionAnnotationSchema.extend({
    type: z.literal('boolean'),
    label: z.object({
        true: z.string(),
        false: z.string(),
    }).optional(),
    default: z.boolean().optional(),
}) satisfies ZodType<ContentDefinition<'boolean'>>;

const choiceDefinitionSchema: ZodType<ChoiceDefinition> = z.object({
    label: z.string().optional(),
    description: z.string().optional(),
    default: z.boolean().optional(),
    position: z.number().optional(),
});

const textDefinitionSchema = definitionAnnotationSchema.extend({
    type: z.literal('text'),
    minimumLength: z.number().optional(),
    maximumLength: z.number().optional(),
    format: z.string().optional(),
    pattern: z.string().optional(),
    choices: z.record(choiceDefinitionSchema).optional(),
}) satisfies ZodType<ContentDefinition<'text'>>;

const numberDefinitionSchema = definitionAnnotationSchema.extend({
    type: z.literal('number'),
    integer: z.boolean().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
}) satisfies ZodType<ContentDefinition<'number'>>;

const attributeDefinitionSchema: ZodType<AttributeDefinition> = z.lazy(
    () => z.object({
        type: z.lazy((): ZodType<ContentDefinition> => contentDefinitionSchema),
        label: z.string().optional(),
        description: z.string().optional(),
        optional: z.boolean().optional(),
        private: z.boolean().optional(),
        position: z.number().optional(),
    }),
);

const structureDefinitionSchema = definitionAnnotationSchema.extend({
    type: z.literal('structure'),
    attributes: z.record(z.string(), attributeDefinitionSchema),
}) satisfies ZodType<ContentDefinition<'structure'>>;

const listDefinitionSchema = definitionAnnotationSchema.extend({
    type: z.literal('list'),
    items: z.lazy((): ZodType<ContentDefinition> => contentDefinitionSchema),
    itemLabel: z.string().optional(),
    minimumLength: z.number().optional(),
    maximumLength: z.number().optional(),
}) satisfies ZodType<ContentDefinition<'list'>>;

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const jsonSchema: z.ZodType<JsonValue> = z.lazy(
    () => z.union([
        jsonPrimitiveSchema,
        z.array(jsonSchema),
        z.record(jsonSchema),
    ]),
);

const referenceDefinitionSchema = definitionAnnotationSchema.extend({
    type: z.literal('reference'),
    id: z.string(),
    properties: z.record(z.string(), jsonSchema).optional(),
}) satisfies ZodType<ContentDefinition<'reference'>>;

const unionDefinitionSchema = definitionAnnotationSchema.extend({
    type: z.literal('union'),
    types: z.record(
        z.string(),
        z.discriminatedUnion('type', [
            structureDefinitionSchema,
            referenceDefinitionSchema,
        ]),
    ),
}) satisfies ZodType<ContentDefinition<'union'>>;

const contentDefinitionSchema: ZodType<ContentDefinition> = z.discriminatedUnion('type', [
    booleanDefinitionSchema,
    textDefinitionSchema,
    numberDefinitionSchema,
    structureDefinitionSchema,
    listDefinitionSchema,
    unionDefinitionSchema,
    referenceDefinitionSchema,
]);

const rootContentDefinitionSchema: ZodType<RootDefinition> = z.discriminatedUnion('type', [
    structureDefinitionSchema,
    unionDefinitionSchema,
]);

const componentDefinitionSchema: ZodType<ComponentDefinition> = z.object({
    name: z.string().min(1),
    description: z.string()
        .min(1)
        .optional(),
    definition: rootContentDefinitionSchema,
});

const stringContentValueSchema: ZodType<PrimitiveValue<string>> = z.union([
    z.object({
        type: z.literal('static'),
        value: z.string(),
    }),
    z.object({
        type: z.literal('dynamic'),
        expression: z.string(),
        nullable: z.literal(false),
        default: z.string(),
    }),
    z.object({
        type: z.literal('dynamic'),
        expression: z.string(),
        nullable: z.literal(true),
        default: z.string().optional(),
    }),
]);

const numberContentValueSchema: ZodType<PrimitiveValue<number>> = z.union([
    z.object({
        type: z.literal('static'),
        value: z.number(),
    }),
    z.object({
        type: z.literal('dynamic'),
        nullable: z.literal(false),
        default: z.number(),
        expression: z.string(),
    }),
    z.object({
        type: z.literal('dynamic'),
        nullable: z.literal(true),
        default: z.number().optional(),
        expression: z.string(),
    }),
]);

const booleanContentValueSchema: ZodType<PrimitiveValue<boolean>> = z.union([
    z.object({
        type: z.literal('static'),
        value: z.boolean(),
    }),
    z.object({
        type: z.literal('dynamic'),
        nullable: z.literal(false),
        default: z.boolean(),
        expression: z.string(),
    }),
    z.object({
        type: z.literal('dynamic'),
        nullable: z.literal(true),
        default: z.boolean().optional(),
        expression: z.string(),
    }),
]);

const textContentSchema = z.object({
    type: z.literal('text'),
    value: stringContentValueSchema,
}) satisfies ZodType<Content<'text'>>;

const numberContentSchema = z.object({
    type: z.literal('number'),
    value: numberContentValueSchema,
}) satisfies ZodType<Content<'number'>>;

const booleanContentSchema = z.object({
    type: z.literal('boolean'),
    value: booleanContentValueSchema,
}) satisfies ZodType<Content<'boolean'>>;

const structureContentSchema = z.object({
    type: z.literal('structure'),
    name: z.string().optional(),
    attributes: z.record(z.string(), z.lazy((): ZodType<Content> => contentSchema)),
}) satisfies ZodType<Content<'structure'>>;

const listContentSchema = z.object({
    type: z.literal('list'),
    items: z.array(z.lazy((): ZodType<Content> => contentSchema)),
}) satisfies ZodType<Content<'list'>>;

const contentSchema: ZodType<Content> = z.discriminatedUnion('type', [
    textContentSchema,
    numberContentSchema,
    booleanContentSchema,
    structureContentSchema,
    listContentSchema,
]);

const localizedSlotContentSchema: ZodType<LocalizedContentMap> = z.record(
    z.string(),
    structureContentSchema,
);

const slotDefinitionSchema: ZodType<SlotDefinition> = z.object({
    name: z.string().min(1),
    component: z.string().min(1),
    content: localizedSlotContentSchema,
});

const slotContentMap: ZodType<SlotContentMap> = z.record(
    z.string(),
    localizedSlotContentSchema,
);

const segmentedContentSchema: ZodType<SegmentedContentDefinition> = z.object({
    audiences: z.array(z.string()),
    content: slotContentMap,
});

const personalizedContentSchema: ZodType<PersonalizedContentDefinition> = z.object({
    default: slotContentMap,
    segmented: z.array(segmentedContentSchema),
});

const experimentVariantSchema: ZodType<VariantDefinition> = z.object({
    name: z.string(),
    content: personalizedContentSchema,
    baseline: z.boolean().optional(),
    allocation: z.number()
        .min(0)
        .max(1),
});

const experienceDefinitionSchema: ZodType<ExperienceDefinition> = z.object({
    name: z.string(),
    draft: z.boolean().optional(),
    audiences: z.array(z.string()),
    slots: z.array(z.string()),
    experiment: z.object({
        name: z.string(),
        goalId: z.string().optional(),
        crossDevice: z.boolean().optional(),
        traffic: z.number()
            .min(0)
            .max(1),
        variants: z.array(experimentVariantSchema),
        content: localizedSlotContentSchema,
    }).optional(),
    content: personalizedContentSchema,
});

const schema: ZodType<CreateResourceOptions> = z.object({
    resources: z.object({
        audiences: z.record(z.string().min(1), audienceDefinitionSchema).optional(),
        components: z.record(z.string().min(1), componentDefinitionSchema).optional(),
        slots: z.record(z.string().min(1), slotDefinitionSchema).optional(),
        experiences: z.array(experienceDefinitionSchema).optional(),
    }),
    output: z.object({
        audiences: outputMapSchema.optional(),
        components: outputMapSchema.optional(),
        slots: outputMapSchema.optional(),
        experiences: outputListSchema.optional(),
        experiments: outputListSchema.optional(),
    }).optional(),
});

export class CreateResourceOptionsValidator extends ActionOptionsValidator<CreateResourceOptions> {
    public constructor() {
        super(schema);
    }
}
