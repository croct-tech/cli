import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {ReplaceFileContentOptions} from '@/application/template/action/replaceFileContentAction';

const schema: ZodType<ReplaceFileContentOptions> = z.object({
    files: z.array(
        z.object({
            path: z.string(),
            replacements: z.array(
                z.object({
                    pattern: z.string().refine(value => {
                        try {
                            // eslint-disable-next-line no-new -- Fastest way to validate a regular expression
                            new RegExp(value);

                            return true;
                        } catch {
                            return {message: 'Invalid regular expression pattern'};
                        }
                    }),
                    caseSensitive: z.boolean().optional(),
                    value: z.string(),
                }),
            ).min(1),
        }),
    ).min(1),
});

export class ReplaceFileContentOptionsValidator extends ZodValidator<ReplaceFileContentOptions> {
    public constructor() {
        super(schema);
    }
}
