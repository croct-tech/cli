import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

type IntegrateCroctOptions = Record<never, never>;

const schema: ZodType<IntegrateCroctOptions> = z.strictObject({});

export class IntegrateCroctOptionsValidator extends ActionOptionsValidator<IntegrateCroctOptions> {
    public constructor() {
        super(schema);
    }
}
