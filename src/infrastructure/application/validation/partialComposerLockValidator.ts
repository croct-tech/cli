import type {ZodType} from 'zod';
import {z} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import type {ComposerLock} from '@/application/project/packageManager/composerPackageManager';

const lockPackageSchema = z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    provide: z.record(z.string()).optional(),
});

const lockSchema: ZodType<ComposerLock> = z.object({
    packages: z.array(lockPackageSchema).optional(),
    'packages-dev': z.array(lockPackageSchema).optional(),
});

export class PartialComposerLockValidator extends ZodValidator<ComposerLock> {
    public constructor() {
        super(lockSchema);
    }
}
