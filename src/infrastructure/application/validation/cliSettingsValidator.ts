import {z, ZodType} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {CliConfiguration} from '@/application/cli/configuration/store';

const schema: ZodType<CliConfiguration> = z.strictObject({
    projectPaths: z.array(z.string().min(1)),
    isDeepLinkingEnabled: z.boolean().optional(),
});

export class CliSettingsValidator extends ZodValidator<CliConfiguration> {
    public constructor() {
        super(schema);
    }
}
