import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {LogOptions} from '@/application/template/action/logAction';
import {FailOptions} from '@/application/template/action/failAction';

const schema: ZodType<FailOptions> = z.object({
    title: z.string()
        .min(1)
        .optional(),
    message: z.string().min(1),
    links: z.array(
        z.object({
            url: z.string().url(),
            description: z.string().min(1),
        }),
    ).optional(),
    suggestions: z.array(z.string().min(1)).optional(),
    details: z.array(z.string().min(1)).optional(),
});

export class FailOptionsValidator extends ZodValidator<LogOptions> {
    public constructor() {
        super(schema);
    }
}
