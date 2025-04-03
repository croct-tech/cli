import {z, ZodType} from 'zod';
import {LocateFileOptions, ContentMatcher, PatternMatcher} from '@/application/template/action/locateFileAction';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';

const patternMatcherSchema: ZodType<PatternMatcher> = z.strictObject({
    pattern: z.string().min(1),
    caseSensitive: z.boolean().optional(),
});

const matcherSchema: ZodType<ContentMatcher> = z.union([
    patternMatcherSchema,
    z.strictObject({
        type: z.enum(['and', 'or']),
        matchers: z.array(z.lazy(() => matcherSchema)).min(1),
    }),
]);

const schema: ZodType<LocateFileOptions> = z.strictObject({
    path: z.string().min(1),
    matcher: matcherSchema.optional(),
    limit: z.number()
        .int()
        .positive()
        .optional(),
    depth: z.number()
        .int()
        .nonnegative()
        .optional(),
    result: z.string(),
});

export class LocateFileOptionsValidator extends ActionOptionsValidator<LocateFileOptions> {
    public constructor() {
        super(schema);
    }
}
