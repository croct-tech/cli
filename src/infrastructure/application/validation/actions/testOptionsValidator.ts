import {z, ZodType} from 'zod';
import {TestOptions} from '@/application/template/action/testAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<TestOptions> = z.strictObject({
    condition: z.boolean(),
    then: z.instanceof(Promise),
    else: z.instanceof(Promise).optional(),
});

export class TestOptionsValidator extends ActionOptionsValidator<TestOptions> {
    public constructor() {
        super(schema);
    }
}
