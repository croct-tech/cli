import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {AddDependencyOptions} from '@/application/template/action/addDependencyAction';

const schema: ZodType<AddDependencyOptions> = z.object({
    dependencies: z.array(z.string().min(1)).min(1),
    development: z.boolean().optional(),
});

export class AddDependencyOptionsValidator extends ZodValidator<AddDependencyOptions> {
    public constructor() {
        super(schema);
    }
}
