import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {AddSlotOptions} from '@/application/template/action/addSlotAction';

const schema: ZodType<AddSlotOptions> = z.object({
    slots: z.array(z.string().min(1)).min(1),
    example: z.boolean().optional(),
});

export class AddSlotOptionsValidator extends ZodValidator<AddSlotOptions> {
    public constructor() {
        super(schema);
    }
}
