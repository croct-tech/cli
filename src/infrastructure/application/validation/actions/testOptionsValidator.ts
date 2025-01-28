import {z, ZodType} from 'zod';
import {TestOptions} from '@/application/template/action/testAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const actionsSchema = z.custom<Array<Promise<unknown>>>().transform(
    value => (Array.isArray(value) ? value : [value]),
);

const schema: ZodType<TestOptions> = z.strictObject({
    condition: z.boolean(),
    then: actionsSchema,
    else: actionsSchema.optional(),
});

export class TestOptionsValidator extends ActionOptionsValidator<TestOptions> {
    public constructor() {
        super(schema);
    }
}
