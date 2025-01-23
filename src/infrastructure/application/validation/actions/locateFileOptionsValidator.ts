import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {LocateFileOptions, Matcher, PatternMatcher} from '@/application/template/action/locateFileAction';

const patternMatcherSchema: ZodType<PatternMatcher> = z.object({
    pattern: z.string().min(1),
    caseSensitive: z.boolean().optional(),
});

const matcherSchema: ZodType<Matcher> = z.union([
    patternMatcherSchema,
    z.object({
        type: z.enum(['and', 'or']),
        matchers: z.array(z.lazy(() => matcherSchema)).min(1),
    }),
]);

const schema: ZodType<LocateFileOptions> = z.object({
    path: z.string().min(1),
    matcher: matcherSchema.optional(),
    max: z.number()
        .int()
        .positive()
        .optional(),
    output: z.object({
        paths: z.string()
            .min(1)
            .optional(),
        extensions: z.string()
            .min(1)
            .optional(),
    }).optional(),
});

export class LocateFileOptionsValidator extends ZodValidator<LocateFileOptions> {
    public constructor() {
        super(schema);
    }
}
