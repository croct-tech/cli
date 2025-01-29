import {z, ZodType} from 'zod';
import {TryOptions} from '@/application/template/action/tryAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const actionsSchema: ZodType<Array<Promise<unknown>>> = z.any()
    .transform(value => (Array.isArray(value) ? value : [value]))
    .pipe(z.array(z.promise(z.unknown())));

const schema: ZodType<TryOptions> = z.strictObject({
    action: actionsSchema,
    else: actionsSchema.optional(),
    help: z.strictObject({
        message: z.string()
            .min(1)
            .optional(),
        links: z.array(
            z.strictObject({
                url: z.string().url(),
                description: z.string().min(1),
            }),
        ).optional(),
        suggestions: z.array(z.string().min(1)).optional(),
    }).optional(),
});

export class TryOptionsValidator extends ActionOptionsValidator<TryOptions> {
    public constructor() {
        super(schema);
    }
}
