import type {ZodType} from 'zod';
import {z} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import type {ChangeDirectoryOptions} from '@/application/template/action/changeDirectoryAction';

const schema: ZodType<ChangeDirectoryOptions> = z.strictObject({
    path: z.string(),
});

export class ChangeDirectoryOptionsValidator extends ActionOptionsValidator<ChangeDirectoryOptions> {
    public constructor() {
        super(schema);
    }
}
