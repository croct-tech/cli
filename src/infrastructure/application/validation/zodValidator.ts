import {ZodType} from 'zod';
import {ValidationResult, Validator, Violation} from '@/application/validation';

export class ZodValidator<T> implements Validator<T> {
    private readonly schema: ZodType<T>;

    public constructor(schema: ZodType<T>) {
        this.schema = schema;
    }

    public validate(data: unknown): ValidationResult<T> {
        const result = this.schema.safeParse(data);

        if (result.success) {
            return {
                success: true,
                data: result.data,
            };
        }

        const {error} = result;

        return {
            success: false,
            violations: error.issues.map<Violation>(
                issue => ({
                    path: issue.path.reduce<string>(
                        (previous, segment) => {
                            if (typeof segment === 'string') {
                                return previous === '' ? segment : `${previous}.${segment}`;
                            }

                            return `${previous}[${segment}]`;
                        },
                        '',
                    ),
                    message: issue.message,
                }),
            ),
        };
    }
}
