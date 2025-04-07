import {ZodType, ZodTypeDef} from 'zod';
import {Validator, ValidationResult, Violation} from '@/application/validation';

export class ZodValidator<O, I = O, D extends ZodTypeDef = ZodTypeDef> implements Validator<O> {
    protected readonly schema: ZodType<O, D, I>;

    public constructor(schema: ZodType<O, D, I>) {
        this.schema = schema;
    }

    public async validate(data: unknown): Promise<ValidationResult<O>> {
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
