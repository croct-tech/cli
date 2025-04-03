import {z, ZodType} from 'zod';
import {JsonValue} from '@croct/json';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {OptionDefinition, Template} from '@/application/template/template';

const baseOptionSchema = z.strictObject({
    description: z.string(),
    required: z.boolean().optional(),
});

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const jsonSchema: z.ZodType<JsonValue> = z.lazy(
    () => z.union([
        jsonPrimitiveSchema,
        z.array(jsonSchema),
        z.record(jsonSchema),
    ]),
);

const optionSchema: ZodType<OptionDefinition> = z.discriminatedUnion('type', [
    baseOptionSchema.extend({
        type: z.literal('reference'),
        default: z.string().optional(),
    }),
    baseOptionSchema.extend({
        type: z.literal('string'),
        choices: z.array(z.string()).optional(),
        default: z.string().optional(),
    }),
    baseOptionSchema.extend({
        type: z.literal('number'),
        default: z.number().optional(),
    }),
    baseOptionSchema.extend({
        type: z.literal('boolean'),
        default: z.boolean().optional(),
    }),
    baseOptionSchema.extend({
        type: z.literal('array'),
        default: z.array(jsonSchema).optional(),
    }),
    baseOptionSchema.extend({
        type: z.literal('object'),
        default: z.record(z.string(), jsonSchema).optional(),
    }),
]);

const templateSchema: ZodType<Template> = z.strictObject({
    $schema: z.string().optional(),
    title: z.string()
        .min(1)
        .optional(),
    description: z.string().optional(),
    options: z.record(
        z.string().min(1),
        optionSchema,
    ).optional(),
    actions: z.array(z.any()),
});

export class TemplateValidator extends ZodValidator<Template> {
    public constructor() {
        super(templateSchema);
    }
}
