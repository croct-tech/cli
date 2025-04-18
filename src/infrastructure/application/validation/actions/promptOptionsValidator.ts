import {z, ZodType, ZodTypeDef} from 'zod';
import {
    ChoiceOptions,
    ConfirmationOptions,
    KeypressOptions,
    MultipleChoiceOptions,
    PromptOptions,
    TextOptions,
} from '@/application/template/action/promptAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const confirmationOptionsSchema = z.strictObject({
    type: z.literal('confirmation'),
    message: z.string(),
    default: z.boolean().optional(),
    result: z.string(),
}) satisfies ZodType<ConfirmationOptions>;

const choiceValueSchema = z.string();

const choiceSchema: ZodType<ChoiceOptions['options'][number], ZodTypeDef, any> = z.preprocess(
    value => (
        typeof value === 'string'
            ? {
                value: value,
                label: value,
            }
            : value
    ),
    z.strictObject({
        value: choiceValueSchema,
        label: z.string()
            .min(1)
            .optional(),
        disabled: z.boolean().optional(),
    }),
).transform(
    option => ({
        ...option,
        label: option.label ?? option.value.toString(),
    }),
);

const choiceOptionsSchema = z.strictObject({
    type: z.literal('choice'),
    message: z.string(),
    options: z.array(choiceSchema),
    default: choiceValueSchema.optional(),
    result: z.string(),
}) satisfies ZodType<ChoiceOptions>;

const multipleChoiceSchema: ZodType<MultipleChoiceOptions['options'][number], ZodTypeDef, any> = z.preprocess(
    value => (
        typeof value === 'string'
            ? {
                value: value,
                label: value,
            }
            : value
    ),
    z.strictObject({
        value: choiceValueSchema,
        label: z.string()
            .min(1)
            .optional(),
        selected: z.boolean().optional(),
        disabled: z.boolean().optional(),
    }),
).transform(
    option => ({
        ...option,
        label: option.label ?? option.value.toString(),
    }),
);

const multipleChoiceOptionsSchema = z.strictObject({
    type: z.literal('multi-choice'),
    message: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(multipleChoiceSchema),
    result: z.string(),
}) satisfies ZodType<MultipleChoiceOptions>;

const textOptionsSchema = z.strictObject({
    type: z.literal('text'),
    message: z.string(),
    default: z.string().optional(),
    required: z.boolean().optional(),
    result: z.string(),
}) satisfies ZodType<TextOptions>;

const keypressOptionsSchema = z.strictObject({
    type: z.literal('keypress'),
    message: z.string(),
    key: z.union([
        z.literal('enter'),
        z.literal('space'),
        z.string().length(1),
    ]).optional(),
    result: z.string().optional(),
}) satisfies ZodType<KeypressOptions>;

const schema: ZodType<PromptOptions> = z.discriminatedUnion('type', [
    confirmationOptionsSchema,
    choiceOptionsSchema,
    multipleChoiceOptionsSchema,
    textOptionsSchema,
    keypressOptionsSchema,
]);

export class PromptOptionsValidator extends ActionOptionsValidator<PromptOptions> {
    public constructor() {
        super(schema);
    }
}
