import {z, ZodType} from 'zod';
import {AddDependencyOptions} from '@/application/template/action/addDependencyAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<AddDependencyOptions> = z.strictObject({
    dependencies: z.array(z.string().min(1)).min(1),
    development: z.boolean().optional(),
});

export class AddDependencyOptionsValidator extends ActionOptionsValidator<AddDependencyOptions> {
    public constructor() {
        super(schema);
    }
}
