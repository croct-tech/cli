import {z, ZodType} from 'zod';
import {AddComponentOptions} from '@/application/template/action/addComponentAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<AddComponentOptions> = z.strictObject({
    components: z.array(z.string().min(1)).min(1),
});

export class AddComponentOptionsValidator extends ActionOptionsValidator<AddComponentOptions> {
    public constructor() {
        super(schema);
    }
}
