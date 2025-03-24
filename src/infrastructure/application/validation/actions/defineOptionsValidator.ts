import {z, ZodType} from 'zod';
import {JsonValue} from '@croct/json';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {DefineOptions} from '@/application/template/action/defineAction';

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const jsonSchema: z.ZodType<JsonValue> = z.lazy(
    () => z.union([
        jsonPrimitiveSchema,
        z.array(jsonSchema),
        z.record(jsonSchema),
    ]),
);

const schema: ZodType<DefineOptions> = z.strictObject({
    variables: z.record(z.string(), jsonSchema),
});

export class DefineOptionsValidator extends ActionOptionsValidator<DefineOptions> {
    public constructor() {
        super(schema);
    }
}
