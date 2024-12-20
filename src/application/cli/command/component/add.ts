import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Installation, SdkResolver} from '@/application/project/sdk/sdk';
import {Form} from '@/application/cli/form/form';
import {Component} from '@/application/model/entities';
import {ComponentOptions} from '@/application/cli/form/workspace/componentForm';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {CliError, CliErrorCode} from '@/application/cli/error';
import {Configuration as ProjectConfiguration} from '@/application/project/configuration/configuration';
import {Version} from '@/application/project/version';

export type AddComponentInput = {
    components?: string[],
};

export type AddComponentConfig = {
    sdkResolver: SdkResolver,
    configurationManager: ConfigurationManager,
    componentForm: Form<Component[], ComponentOptions>,
    io: {
        input?: Input,
        output: Output,
    },
};

type VersionedComponent = [Component, Version];

export class AddComponentCommand implements Command<AddComponentInput> {
    private readonly config: AddComponentConfig;

    public constructor(config: AddComponentConfig) {
        this.config = config;
    }

    public async execute(input: AddComponentInput): Promise<void> {
        const {sdkResolver, configurationManager, io} = this.config;
        const {output} = io;

        const sdk = await sdkResolver.resolve();
        const configuration = await configurationManager.resolve();
        const components = await this.getComponents(configuration, input);

        if (components.length === 0) {
            output.inform('No components to add');

            return;
        }

        const installation: Installation = {
            input: io.input,
            output: io.output,
            configuration: {
                ...configuration,
                components: {
                    ...configuration.components,
                    ...Object.fromEntries(components.map(
                        ([component, version]) => [component.slug, version.toString()],
                    )),
                },
            },
        };

        await configurationManager.update(installation.configuration);

        output.confirm('Configuration updated');

        await sdk.update(installation);
    }

    private async getComponents(
        configuration: ProjectConfiguration,
        input: AddComponentInput,
    ): Promise<VersionedComponent[]> {
        const {componentForm} = this.config;

        const versionedComponents = input.components === undefined
            ? undefined
            : AddComponentCommand.getVersionMap(input.components, configuration.components);

        const components = await componentForm.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            preselected: versionedComponents === undefined
                ? undefined
                : Object.keys(versionedComponents),
            selected: Object.keys(configuration.components),
        });

        if (
            input.components !== undefined
            && input.components.length > 0 && components.length !== input.components.length
        ) {
            const missingComponents = input.components.filter(
                slug => !components.some(component => component.slug === slug),
            );

            throw new CliError(`Non-existing components: \`${missingComponents.join('`, `')}\``, {
                code: CliErrorCode.INVALID_INPUT,
                suggestions: ['Run `component add` without arguments to see available components'],
            });
        }

        return components.map(component => {
            const version = versionedComponents?.[component.slug];

            if (version === undefined || version.getMaxVersion() === component.version.major) {
                return [component, version ?? Version.of(component.version.major)];
            }

            if (version.getMinVersion() > component.version.major) {
                throw new CliError(
                    `No matching version for component \`${component.slug}\`.`,
                    {
                        code: CliErrorCode.INVALID_INPUT,
                        details: [
                            `Requested version: ${version.toString()}`,
                            `Current version: ${component.version.major}`,
                        ],
                        suggestions: ['Omit version specifier to use the latest version'],
                    },
                );
            }

            return [component, version];
        });
    }

    private static getVersionMap(
        specifiers: string[],
        components: ProjectConfiguration['components'],
    ): Record<string, Version|undefined> {
        return Object.fromEntries(
            specifiers.map<[string, Version|undefined]>(versionedId => {
                const [slug, specifier] = versionedId.split('@', 2);

                if (specifier === undefined) {
                    return [slug, undefined];
                }

                if (!Version.isValid(specifier)) {
                    throw new CliError(
                        `Invalid version specifier \`${specifier}\` for component \`${slug}\`.`,
                        {
                            code: CliErrorCode.INVALID_INPUT,
                            suggestions: [
                                'Version must be exact (i.e. `1`), range (i.e. `1 - 2`), or set (i.e. `1 || 2`).',
                            ],
                        },
                    );
                }

                let version = Version.parse(specifier);

                if (version.getCardinality() > 5) {
                    throw new CliError(
                        `The number of versions specified for component \`${slug}\` exceeds 5 major versions.`,
                        {
                            code: CliErrorCode.INVALID_INPUT,
                            suggestions: [
                                'Narrow down the number of versions to 5 or less.',
                            ],
                        },
                    );
                }

                if (components[slug] !== undefined) {
                    version = Version.parse(components[slug]).combinedWith(version);

                    if (version.getCardinality() > 5) {
                        throw new CliError(
                            `The cumulative number of versions for component \`${slug}\` `
                            + 'cannot exceed 5 major versions.',
                            {
                                code: CliErrorCode.INVALID_INPUT,
                                suggestions: [
                                    'Narrow down the number of versions to 5 or less.',
                                ],
                            },
                        );
                    }
                }

                return [slug, version];
            }),
        );
    }
}
