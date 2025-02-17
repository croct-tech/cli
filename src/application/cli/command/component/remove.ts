import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Sdk} from '@/application/project/sdk/sdk';
import {ProjectConfiguration, ResolvedConfiguration} from '@/application/project/configuration/projectConfiguration';
import {Form} from '@/application/cli/form/form';
import {ComponentOptions} from '@/application/cli/form/workspace/componentForm';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {Version} from '@/application/model/version';
import {Component} from '@/application/model/component';

export type RemoveComponentInput = {
    components?: string[],
};

export type RemoveComponentConfig = {
    sdk: Sdk,
    configurationManager: ConfigurationManager,
    componentForm: Form<Component[], ComponentOptions>,
    io: {
        input?: Input,
        output: Output,
    },
};

export class RemoveComponentCommand implements Command<RemoveComponentInput> {
    private readonly config: RemoveComponentConfig;

    public constructor(config: RemoveComponentConfig) {
        this.config = config;
    }

    public async execute(input: RemoveComponentInput): Promise<void> {
        const {sdk, configurationManager, componentForm, io} = this.config;
        const {output} = io;

        const configuration = await configurationManager.resolve();

        const versionedComponents = input.components === undefined
            ? undefined
            : RemoveComponentCommand.getVersionMap(input.components, configuration.components);

        const components = await componentForm.handle({
            organizationSlug: configuration.organization,
            workspaceSlug: configuration.workspace,
            allowed: Object.keys(configuration.components),
            preselected: versionedComponents === undefined
                ? undefined
                : Object.keys(versionedComponents),
        });

        if (components.length === 0) {
            return output.alert('No components to remove.');
        }

        const updatedConfiguration: ResolvedConfiguration = {
            ...configuration,
            components: Object.fromEntries(
                Object.entries(configuration.components)
                    .flatMap(([slug, version]) => {
                        if (versionedComponents?.[slug] !== undefined) {
                            if (versionedComponents[slug] === null) {
                                return [];
                            }

                            return [[slug, versionedComponents[slug].toString()]];
                        }

                        if (components.some(component => component.slug === slug)) {
                            return [];
                        }

                        return [[slug, version.toString()]];
                    }),
            ),
        };

        output.confirm('Configuration updated');

        await configurationManager.update(updatedConfiguration);

        await sdk.update({
            input: io.input,
            output: io.output,
            configuration: updatedConfiguration,
        });
    }

    private static getVersionMap(
        specifiers: string[],
        components: ProjectConfiguration['components'],
    ): Record<string, Version|null> {
        return Object.fromEntries(
            specifiers.map(versionedId => {
                const [slug, specifier] = versionedId.split('@', 2);

                if (components[slug] === undefined || specifier === undefined) {
                    return [slug, null];
                }

                const currentVersion = Version.parse(components[slug]);

                if (!Version.isValid(specifier)) {
                    return [slug, currentVersion];
                }

                const specifiedVersion = Version.parse(specifier);

                if (!currentVersion.intersects(specifiedVersion)) {
                    return [slug, currentVersion];
                }

                if (!specifiedVersion.contains(currentVersion)) {
                    return [slug, currentVersion.without(specifiedVersion)];
                }

                return [slug, null];
            }),
        );
    }
}
