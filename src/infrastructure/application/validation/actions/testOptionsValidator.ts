import {z, ZodType} from 'zod';
import {TestOptions} from '@/application/template/action/testAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const actionsSchema: ZodType<Array<Promise<unknown>>> = z.any()
    .transform(value => (Array.isArray(value) ? value : [value]))
    .pipe(z.array(z.promise(z.unknown())));

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
