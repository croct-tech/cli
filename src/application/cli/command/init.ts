import {Command} from '@/application/cli/command/command';
import {WorkspaceApi} from '@/application/api/workspace';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Sdk} from '@/application/project/sdk/sdk';
import {ProjectConfiguration} from '@/application/project/configuration/projectConfiguration';
import {OrganizationOptions, SelectedOrganization} from '@/application/cli/form/organization/organizationForm';
import {ApplicationOptions} from '@/application/cli/form/application/applicationForm';
import {SelectedWorkspace, WorkspaceOptions} from '@/application/cli/form/workspace/workspaceForm';
import {Form} from '@/application/cli/form/form';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {UserApi} from '@/application/api/user';
import {OrganizationApi} from '@/application/api/organization';
import {ApiError} from '@/application/api/error';
import {Organization} from '@/application/model/organization';
import {Workspace} from '@/application/model/workspace';
import {Application, ApplicationEnvironment} from '@/application/model/application';
import {ErrorReason, HelpfulError} from '@/application/error';
import {Platform} from '@/application/model/platform';
import {Provider} from '@/application/provider/provider';
import {Slot} from '@/application/model/slot';
import {SlotOptions} from '@/application/cli/form/workspace/slotForm';

export type Resource = 'organization' | 'workspace' | 'application';

export type InitInput = {
    override?: boolean,
    sdk?: string,
    new?: Resource,
    organization?: string,
    workspace?: string,
    devApplication?: string,
    prodApplication?: string,
    skipApiKeySetup?: boolean,
};

export type InitConfig = {
    sdkProvider: Provider<Sdk|null>,
    platformProvider: Provider<Platform|null>,
    configurationManager: ConfigurationManager,
    skipConfirmation: Provider<boolean>,
    form: {
        organization: Form<Organization, OrganizationOptions>,
        workspace: Form<Workspace, WorkspaceOptions>,
        application: Form<Application, ApplicationOptions>,
        slot: Form<Slot[], SlotOptions>,
    },
    api: {
        user: UserApi,
        organization: OrganizationApi,
        workspace: WorkspaceApi,
    },
    io: {
        input?: Input,
        output: Output,
    },
};

export class InitCommand implements Command<InitInput> {
    private readonly config: InitConfig;

    public constructor(config: InitConfig) {
        this.config = config;
    }

    public async execute(input: InitInput): Promise<void> {
        const {configurationManager, platformProvider, sdkProvider, io: {output}} = this.config;

        const currentConfiguration = input.override !== true && await configurationManager.isInitialized()
            ? {...await configurationManager.loadPartial()}
            : null;

        const platform = await platformProvider.get();
        const projectName = platform !== null
            ? `${Platform.getName(platform)} project`
            : 'project';

        output.break();

        output.announce({
            semantics: 'neutral',
            title: '👋 Welcome to Croct',
            alignment: 'center',
            message: `Let's configure your ${projectName} to get started!`,
        });

        output.break();

        const organization = await this.getOrganization(
            {new: input.new === 'organization'},
            input.new === 'organization'
                ? undefined
                : (input.organization ?? currentConfiguration?.organization),
        );

        const workspace = await this.getWorkspace(
            {
                organization: organization,
                new: organization.new !== true && input.new === 'workspace',
            },
            (input.new === 'workspace' || organization.new === true)
                ? undefined
                : (input.workspace ?? currentConfiguration?.workspace),
        );

        const applicationOptions: Omit<ApplicationOptions, 'environment'> = {
            organization: organization,
            workspace: workspace,
            platform: platform ?? Platform.JAVASCRIPT,
            new: workspace.new !== true && input.new === 'application',
        };

        const devApplication = await this.getApplication(
            {
                ...applicationOptions,
                environment: ApplicationEnvironment.DEVELOPMENT,
            },
            (input.new !== undefined || workspace.new === true)
                ? undefined
                : (input.devApplication ?? currentConfiguration?.applications?.development),
        );

        const updatedConfiguration: ProjectConfiguration = {
            organization: organization.slug,
            workspace: workspace.slug,
            applications: {
                development: devApplication.slug,
            },
            defaultLocale: workspace.defaultLocale,
            locales: [...new Set([...(currentConfiguration?.locales ?? []), ...workspace.locales])],
            slots: currentConfiguration?.slots ?? {},
            components: currentConfiguration?.components ?? {},
            paths: currentConfiguration?.paths ?? {},
        };

        const prodApplication = await this.resolveApplication(
            {
                ...applicationOptions,
                environment: ApplicationEnvironment.PRODUCTION,
            },
            input.new !== undefined
                ? undefined
                : (input.prodApplication ?? currentConfiguration?.applications?.production),
        );

        if (prodApplication !== null) {
            updatedConfiguration.applications.production = prodApplication.slug;
        }

        if (currentConfiguration !== null) {
            await configurationManager.update(updatedConfiguration);

            output.confirm('Project configuration updated');

            return;
        }

        const sdk = await sdkProvider.get();

        if (sdk === null) {
            await configurationManager.update(updatedConfiguration);

            output.warn('No suitable SDK found, skipping project configuration');

            return;
        }

        await configurationManager.update(
            await this.configure(sdk, updatedConfiguration, input.skipApiKeySetup === true),
        );
    }

    private async getOrganization(
        options: OrganizationOptions,
        organizationSlug?: string,
    ): Promise<SelectedOrganization> {
        const {form, api} = this.config;

        const organization = organizationSlug === undefined
            ? await form.organization.handle(options)
            : await api.user
                .getOrganization(organizationSlug)
                .catch(error => {
                    if (error instanceof ApiError && error.isAccessDenied()) {
                        return null;
                    }

                    throw error;
                });

        if (organization === null) {
            throw new HelpfulError(`No organization found with slug "${organizationSlug}".`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        return organization;
    }

    private async getWorkspace(options: WorkspaceOptions, workspaceSlug?: string): Promise<SelectedWorkspace> {
        const {form, api} = this.config;

        const workspace = workspaceSlug === undefined
            ? await form.workspace.handle(options)
            : await api.organization
                .getWorkspace({
                    organizationSlug: options.organization.slug,
                    workspaceSlug: workspaceSlug,
                })
                .catch(error => {
                    if (error instanceof ApiError && error.isAccessDenied()) {
                        return null;
                    }

                    throw error;
                });

        if (workspace === null) {
            throw new HelpfulError(`No workspace found with slug "${workspaceSlug}".`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        return workspace;
    }

    private async resolveApplication(options: ApplicationOptions, applicationSlug?: string): Promise<Application|null> {
        const {api} = this.config;

        const defaultWebsite = options.workspace.website ?? options.organization.website ?? undefined;
        // Prod application can only be created if the default website is not localhost
        const isPublicUrl = defaultWebsite !== undefined && new URL(defaultWebsite).hostname !== 'localhost';

        if (
            (options.environment === ApplicationEnvironment.DEVELOPMENT || isPublicUrl)
            || applicationSlug !== undefined
            || options.new === true
        ) {
            // Continue to the regular flow if either creating a new application
            // is possible (dev environment or public URL), a specific application slug is provided,
            // or the user wants to create a new application.
            return this.getApplication(options, applicationSlug);
        }

        const applications = api.workspace.getApplications({
            organizationSlug: options.organization.slug,
            workspaceSlug: options.workspace.slug,
        });

        for (const application of await applications) {
            if (application.environment === options.environment) {
                // There is an existing application for the specified environment,
                // auto-select it or prompt the user to select it.
                return this.getApplication(options, applicationSlug);
            }
        }

        return null;
    }

    private async getApplication(options: ApplicationOptions, applicationSlug?: string): Promise<Application> {
        const {form, api} = this.config;

        const application = applicationSlug === undefined
            ? await form.application.handle(options)
            : await api.workspace
                .getApplication({
                    organizationSlug: options.organization.slug,
                    workspaceSlug: options.workspace.slug,
                    applicationSlug: applicationSlug,
                })
                .catch(error => {
                    if (error instanceof ApiError && error.isAccessDenied()) {
                        return null;
                    }

                    throw error;
                });

        if (application === null) {
            throw new HelpfulError(`No application found with slug "${applicationSlug}".`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        if (application.environment !== options.environment) {
            throw new HelpfulError(
                `No ${ApplicationEnvironment.getLabel(options.environment).toUpperCase()} application `
                + `found with slug "${applicationSlug}".`,
                {reason: ErrorReason.INVALID_INPUT},
            );
        }

        return application;
    }

    private async configure(
        sdk: Sdk,
        configuration: ProjectConfiguration,
        skipApiKeySetup: boolean,
    ): Promise<ProjectConfiguration> {
        const {skipConfirmation} = this.config;

        const updatedConfiguration = await sdk.setup({
            input: this.config.io.input === undefined || await skipConfirmation.get()
                ? undefined
                : this.config.io.input,
            output: this.config.io.output,
            skipApiKeySetup: skipApiKeySetup,
            configuration: configuration,
        });

        return InitCommand.canonicalizePaths(updatedConfiguration);
    }

    private static canonicalizePaths(configuration: ProjectConfiguration): ProjectConfiguration {
        if (configuration.paths === undefined) {
            return configuration;
        }

        return {
            ...configuration,
            paths: Object.fromEntries(
                Object.entries(configuration.paths).map(
                    ([key, path]) => [key, InitCommand.canonicalizePath(path)],
                ),
            ),
        };
    }

    private static canonicalizePath(path: string): string {
        return path.replace(/\\/g, '/');
    }
}
