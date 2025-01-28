import {z} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';

const mappingSchema = z.strictObject({
    pattern: z.string().refine(value => {
        try {
            // eslint-disable-next-line no-new -- Fastest way to validate a regular expression
            new RegExp(value);

            return true;
        } catch {
            return {
                message: 'Invalid regular expression.',
            };
        }
    }),
    destination: z.string(),
});

const registrySchema = z.array(mappingSchema);

export class RegistryValidator extends ZodValidator<z.infer<typeof registrySchema>> {
    public constructor() {
        super(registrySchema);
    }
}
