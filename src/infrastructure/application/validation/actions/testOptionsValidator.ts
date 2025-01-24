import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {TestOptions} from '@/application/template/action/test';

const actionDefinitionSchema = z.object({name: z.string().min(1)}).passthrough();

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
