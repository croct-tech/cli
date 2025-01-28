import {z, ZodType} from 'zod';
import {StartServerOptions} from '@/application/template/action/startServerAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<StartServerOptions> = z.strictObject({
    result: z.strictObject({
        url: z.string().optional(),
        initiator: z.string().optional(),
    }).optional(),
});

export class StartServerOptionsValidator extends ActionOptionsValidator<StartServerOptions> {
    public constructor() {
        super(schema);
    }
}
