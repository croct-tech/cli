import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {TryOptions} from '@/application/template/action/tryAction';

const actionDefinitionSchema = z.object({name: z.string().min(1)}).passthrough();

const schema: ZodType<TryOptions> = z.object({
    action: actionDefinitionSchema,
    otherwise: actionDefinitionSchema.optional(),
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

export class TryOptionsValidator extends ZodValidator<TryOptions> {
    public constructor() {
        super(schema);
    }
}
