import {join, relative} from 'path';
import {readFile, writeFile} from 'fs/promises';
import {z} from 'zod';
import {Configuration, ConfigurationError} from '@/application/project/configuration/configuration';
import {Version} from '@/application/project/version';
import {ConfigurationFile} from '@/application/project/configuration/file/configurationFile';
import {JsonObjectNode, JsonParser} from '@/infrastructure/json';

const identifierSchema = z.string().regex(
    /^[A-Za-z]+(-?[A-Za-z0-9]+)*$/,
    'An identifier must start with a letter and contain only letters, numbers, and hyphens.',
);

const localeSchema = z.string().regex(
    /^[a-z]{2,3}([-_][a-z]{2,3})?$/i,
    'Locale must be in the form of en, en_US, or en-US.',
);

const versionSchema = z.string().refine(
    Version.isValid,
    'Version must a exact (1), range (1 - 2), or union (1 || 2).',
);

const ConfigurationSchema = z.object({
    organization: identifierSchema,
    workspace: identifierSchema,
    applications: z.object({
        development: identifierSchema,
        production: identifierSchema,
    }),
    locales: z.array(localeSchema),
    defaultLocale: localeSchema,
    slots: z.record(versionSchema),
    components: z.record(versionSchema),
    paths: z.object({
        components: z.string(),
        examples: z.string(),
    }),
}).refine(data => data.locales.includes(data.defaultLocale), {
    message: 'The default locale is not included in the list of locales.',
    path: ['defaultLocale'], // Error will be attached to this path
});

type LoadedFile = {
    path: string,
    source: string|null,
    configuration: Configuration|null,
};

export class JsonFileConfiguration implements ConfigurationFile {
    private readonly projectDirectory: string;

    public constructor(projectDirectory: string) {
        this.projectDirectory = projectDirectory;
    }

    public async load(): Promise<Configuration|null> {
        return (await this.loadFile()).configuration;
    }

    public update(configuration: Configuration): Promise<void> {
        return this.updateFile({
            organization: configuration.organization,
            workspace: configuration.workspace,
            applications: {
                development: configuration.applications.development,
                production: configuration.applications.production,
            },
            defaultLocale: configuration.defaultLocale,
            locales: configuration.locales,
            slots: configuration.slots,
            components: configuration.components,
            paths: {
                components: configuration.paths.components,
                examples: configuration.paths.examples,
            },
        });
    }

    private async updateFile(configuration: Configuration): Promise<void> {
        const file = await this.loadFile();
        const data = file.configuration !== null && file.source !== null
            ? JsonParser.parse(file.source).merge(configuration)
            : JsonObjectNode.of(configuration);

        const json = data.toString({
            indentationCharacter: 'space',
            brace: {
                indentationSize: 2,
                leadingIndentation: true,
                trailingIndentation: true,
                entryIndentation: true,
                colonSpacing: true,
                commaSpacing: true,
            },
            bracket: {
                indentationSize: 2,
                entryIndentation: true,
                leadingIndentation: true,
                trailingIndentation: true,
                colonSpacing: true,
                commaSpacing: true,
            },
        });

        try {
            await writeFile(file.path, json, 'utf8');
        } catch {
            throw new Error(`Unable to write configuration file ${file.path}.`);
        }
    }

    private async loadFile(): Promise<LoadedFile> {
        const file: LoadedFile = {
            path: this.getConfigurationFilePath(),
            source: null,
            configuration: null,
        };

        try {
            file.source = await readFile(file.path, 'utf8');
            file.configuration = JSON.parse(file.source);
        } catch {
            return file;
        }

        if (file.configuration !== null) {
            const result = ConfigurationSchema.safeParse(file.configuration);

            if (result.error !== undefined) {
                const error = result.error.errors[0];
                const path = error.path.reduce(
                    (previous, segment) => {
                        if (typeof segment === 'string') {
                            return previous === '' ? segment : `${previous}.${segment}`;
                        }

                        return `${previous}[${segment}]`;
                    },
                    '',
                );

                throw new ConfigurationError(error.message, [
                    `Configuration file: ${relative(this.projectDirectory, file.path)}`,
                    `Violation path: ${path}`,
                ]);
            }
        }

        return file;
    }

    private getConfigurationFilePath(): string {
        return join(this.projectDirectory, 'croct.json');
    }
}
