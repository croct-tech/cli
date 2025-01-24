import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {CheckDependencyOptions} from '@/application/template/action/checkDependencyAction';

const requirementSchema = z.object({
    name: z.string().min(1),
    version: z.string()
        .min(1)
        .optional(),
    optional: z.boolean().optional(),
});

const schema: ZodType<CheckDependencyOptions> = z.object({
    dependencies: z.array(requirementSchema),
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

export class CheckDependenciesOptionsValidator extends ZodValidator<CheckDependencyOptions> {
    public constructor() {
        super(schema);
    }
}
