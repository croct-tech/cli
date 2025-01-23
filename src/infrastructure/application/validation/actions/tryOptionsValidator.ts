import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {TryOptions} from '@/application/template/action/tryAction';
import {actionDefinitionSchema, helpSchema} from '@/infrastructure/application/validation/actions/schemas';

const schema: ZodType<TryOptions> = z.object({
    action: actionDefinitionSchema,
    otherwise: actionDefinitionSchema.optional(),
    help: helpSchema.optional(),
});

export class TryOptionsValidator extends ZodValidator<TryOptions> {
    public constructor() {
        super(schema);
    }
}
