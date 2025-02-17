import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {CliSettings} from '@/application/cli/settings/settings';

const schema: ZodType<CliSettings> = z.strictObject({
    projectPaths: z.array(z.string().min(1)),
    isDeepLinkingEnabled: z.boolean().optional(),
});

export class CliSettingsValidator extends ZodValidator<CliSettings> {
    public constructor() {
        super(schema);
    }
}
