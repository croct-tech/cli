import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {ResolveImportOptions} from '@/application/template/action/resolveImportAction';

const schema: ZodType<ResolveImportOptions> = z.strictObject({
    path: z.string().min(1),
});

export class ResolveImportOptionsValidator extends ActionOptionsValidator<ResolveImportOptions> {
    public constructor() {
        super(schema);
    }
}
