import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {MovePathOptions} from '@/application/template/action/movePathAction';

const schema: ZodType<MovePathOptions> = z.strictObject({
    path: z.string().min(1),
    destination: z.string().min(1),
    overwrite: z.boolean()
        .optional(),
});

export class MovePathOptionsValidator extends ActionOptionsValidator<MovePathOptions> {
    public constructor() {
        super(schema);
    }
}
