import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {LogOptions} from '@/application/template/action/logAction';

const schema: ZodType<LogOptions> = z.object({
    semantic: z.enum(['neutral', 'info', 'error', 'warning', 'success']).optional(),
    message: z.string(),
});

export class LogOptionsValidator extends ZodValidator<LogOptions> {
    public constructor() {
        super(schema);
    }
}
