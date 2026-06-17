import type {ZodType} from 'zod';
import {z} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import type {PartialComposerManifest} from '@/application/project/packageManager/composerPackageManager';

const pathValue = z.union([z.string(), z.array(z.string())]);

const manifestSchema: ZodType<PartialComposerManifest> = z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    type: z.string().optional(),
    require: z.record(z.string()).optional(),
    'require-dev': z.record(z.string()).optional(),
    scripts: z.record(z.unknown()).optional(),
    autoload: z.object({
        'psr-4': z.record(pathValue).optional(),
    }).optional(),
    bin: z.union([z.string(), z.array(z.string())]).optional(),
    extra: z.record(z.unknown()).optional(),
});

export class PartialComposerManifestValidator extends ZodValidator<PartialComposerManifest> {
    public constructor() {
        super(manifestSchema);
    }
}
