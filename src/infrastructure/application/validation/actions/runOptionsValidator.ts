import {z, ZodType} from 'zod';
import {RunOptions} from '@/application/template/action/runAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {ActionDefinition} from '@/application/template/template';

const actionsSchema: ZodType<ActionDefinition> = z.object({name: z.string().min(1)}).passthrough();

const schema: ZodType<RunOptions> = z.strictObject({
    actions: z.union([actionsSchema, z.array(actionsSchema)]),
});

export class RunOptionsValidator extends ActionOptionsValidator<RunOptions> {
    public constructor() {
        super(schema);
    }
}
