import {z, ZodType} from 'zod';
import {TryOptions} from '@/application/template/action/tryAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<TryOptions> = z.object({
    run: z.union([
        z.array(z.promise(z.unknown())),
        z.promise(z.unknown()),
    ]),
    else: z.union([
        z.array(z.promise(z.unknown())),
        z.promise(z.unknown()),
    ]).optional(),
    help: z.object({
        message: z.string()
            .min(1)
            .optional(),
        links: z.array(
            z.object({
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
