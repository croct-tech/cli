import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {ResolveImportOptions} from '@/application/template/action/resolveImportAction';

const schema: ZodType<ResolveImportOptions> = z.object({
    target: z.string().min(1),
    source: z.string().min(1),
    output: z.object({
        importPath: z.string()
            .min(1)
            .optional(),
    }).optional(),
});

export class ResolveImportOptionsValidator extends ZodValidator<ResolveImportOptions> {
    public constructor() {
        super(schema);
    }
}
