import {z, ZodType} from 'zod';
import {FormatCodeOptions} from '@/application/template/action/formatCodeAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<FormatCodeOptions> = z.object({
    files: z.array(z.string().min(1)).min(1),
});

export class FormatCodeOptionsValidator extends ActionOptionsValidator<FormatCodeOptions> {
    public constructor() {
        super(schema);
    }
}
