import {z, ZodType} from 'zod';
import {StartServerOptions} from '@/application/template/action/startServerAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<StartServerOptions> = z.strictObject({
    server: z.strictObject({
        script: z.string(),
        arguments: z.array(z.string()).optional(),
        url: z.string(),
    }).optional(),
    result: z.strictObject({
        id: z.string().optional(),
        url: z.string().optional(),
    }).optional(),
});

export class StartServerOptionsValidator extends ActionOptionsValidator<StartServerOptions> {
    public constructor() {
        super(schema);
    }
}
