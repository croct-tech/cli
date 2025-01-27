import {z, ZodType} from 'zod';
import {LogOptions} from '@/application/template/action/logAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<LogOptions> = z.object({
    semantic: z.enum(['neutral', 'info', 'error', 'warning', 'success']).optional(),
    message: z.string(),
});

export class LogOptionsValidator extends ActionOptionsValidator<LogOptions> {
    public constructor() {
        super(schema);
    }
}
