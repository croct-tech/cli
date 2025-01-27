import {z, ZodType} from 'zod';
import {TestOptions} from '@/application/template/action/testAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<TestOptions> = z.object({
    if: z.boolean(),
    run: z.union([
        z.array(z.promise(z.unknown())),
        z.promise(z.unknown()),
    ]).optional(),
    else: z.union([
        z.array(z.promise(z.unknown())),
        z.promise(z.unknown()),
    ]).optional(),
});

export class TestOptionsValidator extends ActionOptionsValidator<TestOptions> {
    public constructor() {
        super(schema);
    }
}
