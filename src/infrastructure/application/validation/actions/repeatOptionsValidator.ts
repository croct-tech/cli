import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {RepeatOptions} from '@/application/template/action/repeatAction';

const schema: ZodType<RepeatOptions> = z.strictObject({
    condition: z.instanceof(Promise),
    actions: z.instanceof(Promise),
});

export class RepeatOptionsValidator extends ActionOptionsValidator<RepeatOptions> {
    public constructor() {
        super(schema);
    }
}
