import {z} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';

const packageSchema = z.object({
    name: z.string(),
    version: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
    bin: z.record(z.string()).optional(),
});

export class PartialNpmPackageValidator extends ZodValidator<z.infer<typeof packageSchema>> {
    public constructor() {
        super(packageSchema);
    }
}
