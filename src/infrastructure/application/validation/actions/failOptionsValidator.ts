import {z, ZodType} from 'zod';
import {PrintOptions} from '@/application/template/action/printAction';
import {FailOptions} from '@/application/template/action/failAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<FailOptions> = z.strictObject({
    title: z.string()
        .min(1)
        .optional(),
    message: z.string().min(1),
    links: z.array(
        z.strictObject({
            url: z.string().url(),
            description: z.string().min(1),
        }),
    ).optional(),
    suggestions: z.array(z.string().min(1)).optional(),
    details: z.array(z.string().min(1)).optional(),
});

export class FailOptionsValidator extends ActionOptionsValidator<PrintOptions> {
    public constructor() {
        super(schema);
    }
}
