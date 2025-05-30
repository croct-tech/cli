import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {WriteFileOptions} from '@/application/template/action/writeFile';

const schema: ZodType<WriteFileOptions> = z.strictObject({
    path: z.string().min(1),
    content: z.string(),
    overwrite: z.boolean()
        .optional(),
});

export class WriteFileOptionsValidator extends ActionOptionsValidator<WriteFileOptions> {
    public constructor() {
        super(schema);
    }
}
