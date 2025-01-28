import {z, ZodType} from 'zod';
import {ResolveImportOptions} from '@/application/template/action/resolveImportAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<ResolveImportOptions> = z.strictObject({
    target: z.string().min(1),
    source: z.string().min(1),
    result: z.strictObject({
        importPath: z.string()
            .min(1)
            .optional(),
    }).optional(),
});

export class ResolveImportOptionsValidator extends ActionOptionsValidator<ResolveImportOptions> {
    public constructor() {
        super(schema);
    }
}
