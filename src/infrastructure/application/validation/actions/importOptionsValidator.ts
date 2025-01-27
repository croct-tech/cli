import {z, ZodType} from 'zod';
import {ImportOptions} from '@/application/template/action/importAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<ImportOptions> = z.object({
    template: z.string().min(1),
    input: z.record(z.string().min(1), z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(
            z.union([
                z.string(),
                z.number(),
                z.boolean(),
            ]),
        ),
    ])).optional(),
});

export class ImportOptionsValidator extends ActionOptionsValidator<ImportOptions> {
    public constructor() {
        super(schema);
    }
}
