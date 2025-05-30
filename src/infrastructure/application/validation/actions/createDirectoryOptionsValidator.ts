import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {CreateDirectoryOptions} from '@/application/template/action/createDirectory';

const schema: ZodType<CreateDirectoryOptions> = z.strictObject({
    path: z.string().min(1),
});

export class CreateDirectoryOptionsValidator extends ActionOptionsValidator<CreateDirectoryOptions> {
    public constructor() {
        super(schema);
    }
}
