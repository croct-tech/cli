import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {AddComponentOptions} from '@/application/template/action/addComponentAction';

const schema: ZodType<AddComponentOptions> = z.object({
    components: z.array(z.string().min(1)).min(1),
});

export class AddComponentOptionsValidator extends ZodValidator<AddComponentOptions> {
    public constructor() {
        super(schema);
    }
}
