import {z, ZodType} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {ExecutePackageOptions} from '@/application/template/action/executePackage';

const interactionsSchemaList: ZodType<ExecutePackageOptions['interactions']> = z.array(
    z.object({
        when: z.string(),
        pattern: z.boolean().optional(),
        always: z.boolean().optional(),
        then: z.array(z.string())
            .min(1)
            .optional(),
        final: z.boolean().optional(),
    }).superRefine((value, context) => {
        if (value.then === undefined && value.final === undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Either `then` or `final` must be defined',
            });
        }

        if (value.final === true && value.always === true) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['always'],
                message: 'Final interactions must have `always` set to `false`',
            });
        }

        if (value.pattern === true) {
            try {
                // eslint-disable-next-line no-new -- Fastest way to validate a regular expression
                new RegExp(value.when);
            } catch {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['pattern'],
                    message: 'The `when` field must be a valid regular expression',
                });
            }
        }
    }),
)
    .min(1)
    .optional()
    .refine(value => value === undefined || value.some(interaction => interaction.final === true), {
        message: 'At least one interaction must have `final` set to `true`',
    });

const schema: ZodType<ExecutePackageOptions> = z.strictObject({
    package: z.string(),
    arguments: z.array(z.string()).optional(),
    runner: z.string().optional(),
    interactions: z.union([
        z.boolean(),
        interactionsSchemaList,
    ]),
    output: z.string().optional(),
});

export class ExecutePackageOptionsValidator extends ActionOptionsValidator<ExecutePackageOptions> {
    public constructor() {
        super(schema);
    }
}
