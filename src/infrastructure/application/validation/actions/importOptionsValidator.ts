import {z, ZodType} from 'zod';
import {JsonValue} from '@croct/json';
import {ImportOptions} from '@/application/template/action/importAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const jsonSchema: z.ZodType<JsonValue> = z.lazy(
    () => z.union([
        jsonPrimitiveSchema,
        z.array(jsonSchema),
        z.record(jsonSchema),
    ]),
);

const schema: ZodType<ImportOptions> = z.strictObject({
    template: z.string().min(1),
    share: z.array(z.string().min(1)).optional(),
    options: z.record(z.string().min(1), jsonSchema).optional(),
});

export class ImportOptionsValidator extends ActionOptionsValidator<ImportOptions> {
    public constructor() {
        super(schema);
    }
}
