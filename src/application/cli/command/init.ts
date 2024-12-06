import {Command} from '@/application/cli/command/command';
import {WorkspaceApi} from '@/application/api/workspace';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {
    Application,
    ApplicationEnvironment,
    ApplicationPlatform,
    Organization,
    Workspace,
} from '@/application/model/entities';
import {Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {Configuration, ResolvedConfiguration} from '@/application/project/configuration/configuration';
import {OrganizationOptions} from '@/application/cli/form/organization/organizationForm';
import {ApplicationOptions} from '@/application/cli/form/application/applicationForm';
import {WorkspaceOptions} from '@/application/cli/form/workspace/workspaceForm';
import {Form} from '@/application/cli/form/form';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {UserApi} from '@/application/api/user';
import {OrganizationApi} from '@/application/api/organization';
import {CliError, CliErrorCode} from '@/application/cli/error';
import {ApiError} from '@/application/api/error';

export type Resource = 'organization' | 'workspace' | 'application';

export type InitInput = {
    override?: boolean,
    sdk?: string,
    new?: Resource,
    organization?: string,
    workspace?: string,
    devApplication?: string,
    prodApplication?: string,
};

export type InitConfig = {
    sdkResolver: SdkResolver,
    configurationManager: ConfigurationManager,
    form: {
        organization: Form<Organization, OrganizationOptions>,
        workspace: Form<Workspace, WorkspaceOptions>,
        application: Form<Application, ApplicationOptions>,
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
        const {configurationManager, io: {output}} = this.config;
        const currentConfiguration = await configurationManager.load();

        if (currentConfiguration !== null && input.override !== true) {
            throw new CliError('Configuration file already exists, pass `--override` to reconfigure', {
                code: CliErrorCode.PRECONDITION,
            });
        }

        const {sdkResolver} = this.config;

        output.log('Welcome to **Croct CLI**!');

        const sdk = await sdkResolver.resolve(input.sdk);
        const platform = ApplicationPlatform.getName(sdk.getPlatform());

        output.log(`Let's configure your ${platform} project to get started.`);
        output.break();

        const organization = await this.getOrganization(
            {
                new: input.new === 'organization',
                default: currentConfiguration?.organization,
            },
            input.organization,
        );

        if (organization === null) {
            throw new CliError(`Organization not found: ${input.organization}`, {
                code: CliErrorCode.INVALID_INPUT,
            });
        }

        const workspace = await this.getWorkspace(
            {
                organization: organization,
                new: input.new === 'workspace',
                default: currentConfiguration?.workspace,
            },
            input.workspace,
        );

        const applicationOptions: Omit<ApplicationOptions, 'environment'> = {
            organization: organization,
            workspace: workspace,
            platform: sdk.getPlatform(),
            new: input.new === 'application',
        };

        const devApplication = await this.getApplication(
            {
                ...applicationOptions,
                environment: ApplicationEnvironment.DEVELOPMENT,
                default: currentConfiguration?.applications.development,
            },
            input.devApplication,
        );

        const prodApplication = await this.getApplication(
            {
                ...applicationOptions,
                environment: ApplicationEnvironment.PRODUCTION,
                default: currentConfiguration?.applications.production,
            },
            input.prodApplication,
        );

        await configurationManager.update(
            await this.configure(sdk, {
                organization: organization.slug,
                organizationId: organization.id,
                workspace: workspace.slug,
                workspaceId: workspace.id,
                applications: {
                    production: prodApplication.slug,
                    productionId: prodApplication.id,
                    productionPublicId: prodApplication.publicId,
                    development: devApplication.slug,
                    developmentId: devApplication.id,
                    developmentPublicId: devApplication.publicId,
                },
                defaultLocale: workspace.defaultLocale,
                locales: [workspace.defaultLocale],
                slots: {},
                components: {},
                paths: {
                    components: '',
                    examples: '',
                },
            }),
        );
    }

    private async getOrganization(options: OrganizationOptions, organizationSlug?: string): Promise<Organization> {
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
            throw new CliError(`No organization found with slug "${organizationSlug}".`, {
                code: CliErrorCode.INVALID_INPUT,
            });
        }

        return organization;
    }

    private async getWorkspace(options: WorkspaceOptions, workspaceSlug?: string): Promise<Workspace> {
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
            throw new CliError(`No workspace found with slug "${workspaceSlug}".`, {
                code: CliErrorCode.INVALID_INPUT,
            });
        }

        return workspace;
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
            throw new CliError(`No application found with slug "${applicationSlug}".`, {
                code: CliErrorCode.INVALID_INPUT,
            });
        }

        if (application.environment !== options.environment) {
            throw new CliError(
                `No ${ApplicationEnvironment.getLabel(options.environment)} application `
                + `found with slug "${applicationSlug}".`,
                {code: CliErrorCode.INVALID_INPUT},
            );
        }

        return application;
    }

    private async getSlots(organizationSlug: string, workspaceSlug: string): Promise<Record<string, string>> {
        const {api, io: {output}} = this.config;

        const notifier = output.notify('Loading slots');

        const slots = await api.workspace.getSlots({
            organizationSlug: organizationSlug,
            workspaceSlug: workspaceSlug,
        });

        notifier.stop();

        return Object.fromEntries(slots.map(slot => [slot.slug, `${slot.version.major}`]));
    }

    private async configure(sdk: Sdk, configuration: ResolvedConfiguration): Promise<Configuration> {
        const updatedConfiguration: ResolvedConfiguration = {
            ...configuration,
            slots: await this.getSlots(configuration.organization, configuration.workspace),
        };

        return sdk.install({
            input: this.config.io.input,
            output: this.config.io.output,
            configuration: updatedConfiguration,
        });
    }
}
