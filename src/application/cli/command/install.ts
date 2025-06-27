import {Command} from '@/application/cli/command/command';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {
    ConfigurationManager,
    InitializationState,
} from '@/application/project/configuration/manager/configurationManager';
import {Installation, Sdk} from '@/application/project/sdk/sdk';
import {
    ProjectConfiguration,
    ProjectConfigurationError,
} from '@/application/project/configuration/projectConfiguration';
import {ErrorReason} from '@/application/error';

export type InstallInput = {
    clean?: boolean,
    partialConfiguration?: boolean,
};

export type InstallConfig = {
    sdk: Sdk,
    configurationManager: ConfigurationManager,
    io: {
        input?: Input,
        output: Output,
    },
};

export class InstallCommand implements Command<InstallInput> {
    private readonly configuration: InstallConfig;

    public constructor(config: InstallConfig) {
        this.configuration = config;
    }

    public async execute(input: InstallInput): Promise<void> {
        const {sdk, io} = this.configuration;

        const installation: Installation = {
            input: io.input,
            output: io.output,
            configuration: await this.getConfiguration(input.partialConfiguration ?? false),
        };

        await sdk.update(installation, {clean: input.clean});
    }

    private async getConfiguration(partial: boolean): Promise<ProjectConfiguration> {
        const {configurationManager} = this.configuration;

        if (!partial || await configurationManager.isInitialized(InitializationState.FULL)) {
            return configurationManager.load();
        }

        // Partial configuration allows the install command to run when the project is only
        // partially initialized.
        // This is useful for template projects that have some slots or parts configured,
        // but where values like organization, workspace, and applications must be defined when
        // connecting to the actual workspace.
        const {applications, ...partialConfiguration} = await configurationManager.loadPartial();

        return {
            paths: {},
            slots: {},
            components: {},
            get organization(): string {
                return InstallCommand.reportConfigurationError('organization');
            },
            get workspace(): string {
                return InstallCommand.reportConfigurationError('workspace');
            },
            applications: {
                get development(): string {
                    return InstallCommand.reportConfigurationError('applications.development');
                },
                get production(): string {
                    return InstallCommand.reportConfigurationError('applications.production');
                },
                ...applications,
            },
            get defaultLocale(): string {
                return InstallCommand.reportConfigurationError('defaultLocale');
            },
            get locales(): string[] {
                return InstallCommand.reportConfigurationError('locales');
            },
            ...partialConfiguration,
        };
    }

    private static reportConfigurationError(property: string): never {
        throw new ProjectConfigurationError(
            `The \`${property}\` property is not defined in the project configuration.`,
            {
                reason: ErrorReason.INVALID_CONFIGURATION,
                suggestions: ['Run `init` command to initialize the project configuration.'],
            },
        );
    }
}
