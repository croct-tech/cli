import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {DeletePathOptions} from '@/application/template/action/deletePathAction';

const schema: ZodType<DeletePathOptions> = z.strictObject({
    path: z.string().min(1),
    recursive: z.boolean().optional(),
});

export class DeletePathOptionsValidator extends ActionOptionsValidator<DeletePathOptions> {
    public constructor() {
        super(schema);
    }
}
