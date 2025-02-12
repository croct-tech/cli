import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';

const schema: ZodType<string[]> = z.array(z.string().min(1));

export class ProjectIndexValidator extends ZodValidator<string[]> {
    public constructor() {
        super(schema);
    }
}
