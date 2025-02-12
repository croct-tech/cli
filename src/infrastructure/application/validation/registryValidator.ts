import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {Mapping} from '@/application/template/provider/mappedProvider';

const mappingSchema: ZodType<Mapping> = z.strictObject({
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

const registrySchema: ZodType<Mapping[]> = z.array(mappingSchema);

export class RegistryValidator extends ZodValidator<Mapping[]> {
    public constructor() {
        super(registrySchema);
    }
}
