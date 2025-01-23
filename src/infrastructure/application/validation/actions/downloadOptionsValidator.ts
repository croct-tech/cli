import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {DownloadOptions} from '@/application/template/action/downloadAction';

const schema: ZodType<DownloadOptions> = z.object({
    source: z.string().min(1),
    filter: z.string()
        .min(1)
        .optional(),
    destination: z.string().min(1),
    output: z.object({
        destination: z.string()
            .min(1)
            .optional(),
    }).optional(),
});

export class DownloadOptionsValidator extends ZodValidator<DownloadOptions> {
    public constructor() {
        super(schema);
    }
}
