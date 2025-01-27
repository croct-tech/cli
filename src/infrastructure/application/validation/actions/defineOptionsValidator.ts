import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {DefineOptions} from '@/application/template/action/defineAction';

const schema: ZodType<DefineOptions> = z.object({
    variables: z.record(z.string(), z.string()),
});

export class DefineOptionsValidator extends ActionOptionsValidator<DefineOptions> {
    public constructor() {
        super(schema);
    }
}
