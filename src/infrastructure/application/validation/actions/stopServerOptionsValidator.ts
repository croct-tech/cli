import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {StopServerOptions} from '@/application/template/action/stopServerAction';

const schema: ZodType<StopServerOptions> = z.strictObject({
    id: z.string(),
});

export class StopServerOptionsValidator extends ActionOptionsValidator<StopServerOptions> {
    public constructor() {
        super(schema);
    }
}
