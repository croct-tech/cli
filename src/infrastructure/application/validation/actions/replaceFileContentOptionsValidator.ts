import {z, ZodType} from 'zod';
import {ReplaceFileContentOptions} from '@/application/template/action/replaceFileContentAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const schema: ZodType<ReplaceFileContentOptions> = z.strictObject({
    files: z.array(
        z.strictObject({
            path: z.string(),
            replacements: z.array(
                z.strictObject({
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

export class ReplaceFileContentOptionsValidator extends ActionOptionsValidator<ReplaceFileContentOptions> {
    public constructor() {
        super(schema);
    }
}
