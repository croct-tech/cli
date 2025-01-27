import {z, ZodType} from 'zod';
import {OpenLinkOptions} from '@/application/template/action/openLinkAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<OpenLinkOptions> = z.object({
    url: z.string().url(),
});

export class OpenLinkOptionsValidator extends ActionOptionsValidator<OpenLinkOptions> {
    public constructor() {
        super(schema);
    }
}
