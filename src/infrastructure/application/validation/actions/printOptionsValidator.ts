import type {ZodType} from 'zod';
import {z} from 'zod';
import type {PrintOptions} from '@/application/template/action/printAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<PrintOptions> = z.strictObject({
    semantics: z.enum(['neutral', 'info', 'error', 'warning', 'success']).optional(),
    title: z.string().optional(),
    message: z.string(),
});

export class PrintOptionsValidator extends ActionOptionsValidator<PrintOptions> {
    public constructor() {
        super(schema);
    }
}
