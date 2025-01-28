import {z, ZodType} from 'zod';
import {CheckDependencyOptions} from '@/application/template/action/checkDependencyAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const requirementSchema = z.strictObject({
    name: z.string().min(1),
    version: z.string()
        .min(1)
        .optional(),
    optional: z.boolean().optional(),
});

const schema: ZodType<CheckDependencyOptions> = z.strictObject({
    dependencies: z.array(requirementSchema),
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

export class CheckDependenciesOptionsValidator extends ActionOptionsValidator<CheckDependencyOptions> {
    public constructor() {
        super(schema);
    }
}
