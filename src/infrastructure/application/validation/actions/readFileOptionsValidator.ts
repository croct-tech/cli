import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {ReadFileOptions} from '@/application/template/action/readFile';

const schema: ZodType<ReadFileOptions> = z.strictObject({
    path: z.string().min(1),
    optional: z.boolean().optional(),
    result: z.string().min(1),
});

export class ReadFileOptionsValidator extends ActionOptionsValidator<ReadFileOptions> {
    public constructor() {
        super(schema);
    }
}
