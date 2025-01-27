import {z, ZodType} from 'zod';
import {RunOptions} from '@/application/template/action/runAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const actionDefinitionSchema = z.object({name: z.string().min(1)}).passthrough();

const schema: ZodType<RunOptions> = z.object({
    actions: z.array(actionDefinitionSchema),
});

export class RunOptionsValidator extends ActionOptionsValidator<RunOptions> {
    public constructor() {
        super(schema);
    }
}
