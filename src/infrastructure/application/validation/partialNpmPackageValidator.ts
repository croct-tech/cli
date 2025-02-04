import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {PartialNpmManifest} from '@/application/project/packageManager/nodePackageManager';

const packageSchema: ZodType<PartialNpmManifest> = z.object({
    name: z.string(),
    version: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
    bin: z.record(z.string()).optional(),
    scripts: z.record(z.string()).optional(),
});

export class PartialNpmPackageValidator extends ZodValidator<PartialNpmManifest> {
    public constructor() {
        super(packageSchema);
    }
}
