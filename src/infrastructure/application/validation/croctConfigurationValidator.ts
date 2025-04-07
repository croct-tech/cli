import {z} from 'zod';
import {ZodValidator} from '@/infrastructure/application/validation/zodValidator';
import {Version} from '@/application/model/version';
import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';

const identifierSchema = z.string().regex(
    /^[a-z]+(-?[a-z0-9]+)*$/i,
    'An identifier must start with a letter and contain only letters, numbers, and hyphens.',
);

const localeSchema = z.string().regex(
    /^[a-z]{2,3}([-_][a-z]{2,3})?$/i,
    'Locale must be in the form of en, en_US, or en-US.',
);

const versionSchema = z.string()
    .refine(
        Version.isValid,
        'Version must be exact (1), range (1 - 2), or set (1, 2).',
    )
    .refine(
        version => {
            try {
                return Version.parse(version).getCardinality() <= 5;
            } catch {
                return false;
            }
        },
        'Version range must not exceed 5 major versions.',
    );

type PartialProjectConfiguration = Omit<ProjectConfiguration, 'slots' | 'components'>
    & Partial<Pick<ProjectConfiguration, 'slots' | 'components'>>;

const configurationSchema = z.strictObject({
    $schema: z.string().optional(),
    organization: identifierSchema,
    workspace: identifierSchema,
    applications: z.strictObject({
        development: identifierSchema,
        production: identifierSchema.optional(),
    }),
    locales: z.array(localeSchema).min(1),
    defaultLocale: localeSchema,
    slots: z.record(versionSchema)
        .default({}),
    components: z.record(versionSchema)
        .default({}),
    paths: z.strictObject({
        source: z.string().optional(),
        utilities: z.string().optional(),
        components: z.string().optional(),
        examples: z.string().optional(),
        content: z.string().optional(),
    }).optional(),
}).refine(data => data.locales.includes(data.defaultLocale), {
    message: 'The default locale is not included in the list of locales.',
    path: ['defaultLocale'],
});

export class CroctConfigurationValidator extends ZodValidator<ProjectConfiguration, PartialProjectConfiguration> {
    public constructor() {
        super(configurationSchema);
    }
}
