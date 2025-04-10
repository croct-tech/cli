import {z, ZodType} from 'zod';
import {DownloadOptions} from '@/application/template/action/downloadAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<DownloadOptions> = z.strictObject({
    source: z.string().min(1),
    filter: z.string()
        .min(1)
        .optional(),
    destination: z.string().min(1),
    mapping: z.record(z.string().min(1), z.string().min(1)).optional(),
    overwrite: z.boolean(),
    result: z.strictObject({
        destination: z.string()
            .min(1)
            .optional(),
    }).optional(),
});

export class DownloadOptionsValidator extends ActionOptionsValidator<DownloadOptions> {
    public constructor() {
        super(schema);
    }
}
