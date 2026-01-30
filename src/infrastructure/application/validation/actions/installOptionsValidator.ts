import type {ZodType} from 'zod';
import {z} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import type {InstallOptions} from '@/application/template/action/installAction';

const schema: ZodType<InstallOptions> = z.strictObject({});

export class InstallOptionsValidator extends ActionOptionsValidator<InstallOptions> {
    public constructor() {
        super(schema);
    }
}
