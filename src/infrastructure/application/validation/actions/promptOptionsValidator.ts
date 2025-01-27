import {z, ZodType} from 'zod';
import {
    ChoiceOptions,
    ConfirmationOptions,
    MultipleChoiceOptions,
    PromptOptions,
    TextOptions,
} from '@/application/template/action/promptAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const baseSchema = z.object({
    output: z.string(),
});

const confirmationOptionsSchema = baseSchema.extend({
    type: z.literal('confirmation'),
    message: z.string(),
    labels: z.object({
        true: z.string().min(1),
        false: z.string().min(1),
    }).optional(),
    default: z.boolean().optional(),
}) satisfies ZodType<ConfirmationOptions>;

const choiceValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const choiceOptionsSchema = baseSchema.extend({
    type: z.literal('choice'),
    message: z.string(),
    options: z.array(z.object({
        value: choiceValueSchema,
        label: z.string().min(1),
        disabled: z.boolean().optional(),
    })),
    default: choiceValueSchema.optional(),
}) satisfies ZodType<ChoiceOptions>;

const multipleChoiceOptionsSchema = baseSchema.extend({
    type: z.literal('multi-choice'),
    message: z.string(),
    options: z.array(z.object({
        value: choiceValueSchema,
        label: z.string().min(1),
        disabled: z.boolean().optional(),
        selected: z.boolean().optional(),
    })),
}) satisfies ZodType<MultipleChoiceOptions>;

const textOptionsSchema = baseSchema.extend({
    type: z.literal('text'),
    message: z.string(),
    default: z.string().optional(),
}) satisfies ZodType<TextOptions>;

const schema: ZodType<PromptOptions> = z.discriminatedUnion('type', [
    confirmationOptionsSchema,
    choiceOptionsSchema,
    multipleChoiceOptionsSchema,
    textOptionsSchema,
]);

export class PromptOptionsValidator extends ActionOptionsValidator<PromptOptions> {
    public constructor() {
        super(schema);
    }
}
