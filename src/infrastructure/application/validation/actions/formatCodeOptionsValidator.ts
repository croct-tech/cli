import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {FormatCodeOptions} from '@/application/template/action/formatCodeAction';

const schema: ZodType<FormatCodeOptions> = z.object({
    files: z.array(z.string().min(1)).min(1),
});

export class FormatCodeOptionsValidator extends ZodValidator<FormatCodeOptions> {
    public constructor() {
        super(schema);
    }
}
