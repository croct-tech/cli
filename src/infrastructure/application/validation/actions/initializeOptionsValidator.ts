import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

type InitializeOptions = Record<never, never>;

const schema: ZodType<InitializeOptions> = z.strictObject({});

export class InitializeOptionsValidator extends ActionOptionsValidator<InitializeOptions> {
    public constructor() {
        super(schema);
    }
}
