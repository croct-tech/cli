import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {OptionDefinition, Template} from '@/application/template/template';

const baseOptionSchema = z.object({
    description: z.string(),
    required: z.boolean().optional(),
});

const optionSchema: ZodType<OptionDefinition> = z.discriminatedUnion('type', [
    baseOptionSchema.extend({
        type: z.literal('string'),
        choices: z.array(z.string()).optional(),
        default: z.union([
            z.string(),
            z.function().returns(z.union([z.string(), z.promise(z.string())])),
        ]).optional(),
    }),
    baseOptionSchema.extend({
        type: z.literal('number'),
        default: z.union([
            z.number(),
            z.function().returns(z.union([z.number(), z.promise(z.number())])),
        ]).optional(),
    }),
    baseOptionSchema.extend({
        type: z.literal('boolean'),
        default: z.union([
            z.boolean(),
            z.function().returns(z.union([z.boolean(), z.promise(z.boolean())])),
        ]).optional(),
    }),
    baseOptionSchema.extend({
        type: z.literal('array'),
        default: z.union([
            z.array(z.union([z.string(), z.number(), z.boolean()])),
            z.function().returns(
                z.union([
                    z.array(z.union([z.string(), z.number(), z.boolean()])),
                    z.promise(z.array(z.union([z.string(), z.number(), z.boolean()]))),
                ]),
            ),
        ]),
    }),
]);

const templateSchema: ZodType<Template> = z.object({
    title: z.string()
        .min(1)
        .optional(),
    description: z.string().optional(),
    options: z.record(
        z.string().min(1),
        optionSchema,
    ).optional(),
    actions: z.array(z.object({name: z.string().min(1)}).passthrough()),
});

export class TemplateValidator extends ZodValidator<Template> {
    public constructor() {
        super(templateSchema);
    }
}
