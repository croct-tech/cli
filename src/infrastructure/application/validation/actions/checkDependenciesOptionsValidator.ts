import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {CheckDependencyOptions} from '@/application/template/action/checkDependencyAction';
import {helpSchema} from '@/infrastructure/application/validation/actions/schemas';

const requirementSchema = z.object({
    name: z.string().min(1),
    version: z.string()
        .min(1)
        .optional(),
    optional: z.boolean().optional(),
});

const schema: ZodType<CheckDependencyOptions> = z.object({
    dependencies: z.array(requirementSchema),
    help: helpSchema.optional(),
});

export class CheckDependenciesOptionsValidator extends ZodValidator<CheckDependencyOptions> {
    public constructor() {
        super(schema);
    }
}
