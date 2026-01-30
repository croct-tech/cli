import type {ZodType} from 'zod';
import {z} from 'zod';
import type {AddSlotOptions} from '@/application/template/action/addSlotAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<AddSlotOptions> = z.strictObject({
    slots: z.array(z.string().min(1)).min(1),
    example: z.boolean().optional(),
});

export class AddSlotOptionsValidator extends ActionOptionsValidator<AddSlotOptions> {
    public constructor() {
        super(schema);
    }
}
