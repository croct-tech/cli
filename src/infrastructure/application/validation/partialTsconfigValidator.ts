import {z} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';

const configSchema = z.object({
    extends: z.string().optional(),
    references: z.array(z.object({path: z.string()})).optional(),
    include: z.array(z.string()).optional(),
    compilerOptions: z.object({
        baseUrl: z.string().optional(),
        paths: z.record(z.array(z.string())).optional(),
    }).optional(),
});

export class PartialTsconfigValidator extends ZodValidator<z.infer<typeof configSchema>> {
    public constructor() {
        super(configSchema);
    }
}
