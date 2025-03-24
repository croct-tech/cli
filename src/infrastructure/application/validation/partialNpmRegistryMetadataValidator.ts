import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {PackageMetadata} from '@/application/provider/resource/npmRegistryProvider';

const packageSchema: ZodType<PackageMetadata> = z.object({
    name: z.string(),
    repository: z.object({
        type: z.string(),
        url: z.string(),
    }),
});

export class PartialNpmRegistryMetadataValidator extends ZodValidator<PackageMetadata> {
    public constructor() {
        super(packageSchema);
    }
}
