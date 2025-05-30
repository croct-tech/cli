import {z, ZodType} from 'zod';
import {LocatePathOptions, ContentMatcher, PatternMatcher} from '@/application/template/action/locatePathAction';
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

const schema: ZodType<LocatePathOptions> = z.strictObject({
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

export class LocateFileOptionsValidator extends ActionOptionsValidator<LocatePathOptions> {
    public constructor() {
        super(schema);
    }
}
