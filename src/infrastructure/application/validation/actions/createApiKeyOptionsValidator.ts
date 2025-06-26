import {z, ZodType, ZodTypeDef} from 'zod';
import {ActionOptionsValidator} from '@/infrastructure/application/validation/actions/actionOptionsValidator';
import {CreateApiKeyOptions} from '@/application/template/action/createApiKeyAction';
import {ApiKeyPermission} from '@/application/model/application';

const schema: ZodType<CreateApiKeyOptions, ZodTypeDef, any> = z.strictObject({
    keyName: z.string().min(1),
    environment: z.enum(['development', 'production']),
    permissions: z.array(
        z.enum(
            ApiKeyPermission.all()
                .flatMap(
                    value => [
                        value.toUpperCase(),
                        value.toLowerCase(),
                    ],
                ) as [string, ...string[]],
        ).transform<ApiKeyPermission>(ApiKeyPermission.fromValue),
    ).min(1),
    result: z.string().min(1),
});

export class CreateApiKeyOptionsValidator extends ActionOptionsValidator<CreateApiKeyOptions> {
    public constructor() {
        super(schema);
    }
}
