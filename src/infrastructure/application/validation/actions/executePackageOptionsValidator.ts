import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {ExecutePackageOptions} from '@/application/template/action/executePackage';

const schema: ZodType<ExecutePackageOptions> = z.strictObject({
    package: z.string(),
    arguments: z.array(z.string()).optional(),
    runner: z.string().optional(),
    interactions: z.array(z.object({
        when: z.string(),
        once: z.boolean().optional(),
        then: z.array(z.string()),
    })).optional(),
});

export class ExecutePackageOptionsValidator extends ActionOptionsValidator<ExecutePackageOptions> {
    public constructor() {
        super(schema);
    }
}
