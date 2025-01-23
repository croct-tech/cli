import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {actionDefinitionSchema} from '@/infrastructure/application/validation/actions/schemas';
import {TestOptions} from '@/application/template/action/test';

const schema: ZodType<TestOptions> = z.object({
    condition: z.boolean(),
    then: actionDefinitionSchema.optional(),
    else: actionDefinitionSchema.optional(),
});

export class TestOptionsValidator extends ZodValidator<TestOptions> {
    public constructor() {
        super(schema);
    }
}
