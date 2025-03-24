import {ZodType} from 'zod';
import {Validator, ValidationResult, Violation} from '@/application/validation';

export class ZodValidator<T> implements Validator<T> {
    protected readonly schema: ZodType<T>;

    public constructor(schema: ZodType<T>) {
        this.schema = schema;
    }

    public async validate(data: unknown): Promise<ValidationResult<T>> {
        const result = await this.schema.safeParseAsync(data);

        if (result.success) {
            return {
                valid: true,
                data: result.data,
            };
        }

        const {error} = result;

        return {
            valid: false,
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
