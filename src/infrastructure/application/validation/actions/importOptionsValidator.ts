import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {ImportOptions} from '@/application/template/action/importAction';

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

export class ImportOptionsValidator extends ZodValidator<ImportOptions> {
    public constructor() {
        super(schema);
    }
}
