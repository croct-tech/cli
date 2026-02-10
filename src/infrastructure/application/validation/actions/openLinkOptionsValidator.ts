import type {ZodType} from 'zod';
import {z} from 'zod';
import type {OpenLinkOptions} from '@/application/template/action/openLinkAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<OpenLinkOptions> = z.strictObject({
    url: z.string().url(),
});

export class OpenLinkOptionsValidator extends ActionOptionsValidator<OpenLinkOptions> {
    public constructor() {
        super(schema);
    }
}
