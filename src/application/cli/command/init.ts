import {Command} from '@/application/cli/command/command';
import {WorkspaceApi} from '@/application/api/workspace';
import {Output} from '@/application/cli/io/output';
import {Input} from '@/application/cli/io/input';
import {Sdk} from '@/application/project/sdk/sdk';
import {ProjectConfiguration, ResolvedConfiguration} from '@/application/project/configuration/projectConfiguration';
import {OrganizationOptions} from '@/application/cli/form/organization/organizationForm';
import {ApplicationOptions} from '@/application/cli/form/application/applicationForm';
import {WorkspaceOptions} from '@/application/cli/form/workspace/workspaceForm';
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
    sdkProvider: Provider<Sdk|null>,
    platformProvider: Provider<Platform|null>,
    configurationManager: ConfigurationManager,
    skipConfirmation: Provider<boolean>,
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
        const {configurationManager, platformProvider, sdkProvider, io: {output}} = this.config;
        const currentConfiguration = await configurationManager.load();

        if (currentConfiguration !== null && input.override !== true) {
            throw new HelpfulError('Configuration file already exists, specify `override` to reconfigure.', {
                reason: ErrorReason.PRECONDITION,
            });
        }

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
            input.organization,
        );

        if (organization === null) {
            throw new HelpfulError(`Organization not found: ${input.organization}`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        const workspace = await this.getWorkspace(
            {
                organization: organization,
                new: input.new === 'workspace',
            },
            input.workspace,
        );

        const applicationOptions: Omit<ApplicationOptions, 'environment'> = {
            organization: organization,
            workspace: workspace,
            platform: platform ?? Platform.JAVASCRIPT,
            new: input.new === 'application',
        };

        const devApplication = await this.getApplication(
            {
                ...applicationOptions,
                environment: ApplicationEnvironment.DEVELOPMENT,
            },
            input.devApplication,
        );

        let applicationIds: ResolvedConfiguration['applications'] = {
            development: devApplication.slug,
            developmentId: devApplication.id,
            developmentPublicId: devApplication.publicId,
        };

        const defaultWebsite = workspace.website ?? organization.website ?? undefined;

        if (defaultWebsite !== undefined && new URL(defaultWebsite).hostname !== 'localhost') {
            const prodApplication = await this.getApplication(
                {
                    ...applicationOptions,
                    environment: ApplicationEnvironment.PRODUCTION,
                },
                input.prodApplication,
            );

            applicationIds = {
                ...applicationIds,
                production: prodApplication.slug,
                productionId: prodApplication.id,
                productionPublicId: prodApplication.publicId,
            };
        }

        const updatedConfiguration: ProjectConfiguration = {
            organization: organization.slug,
            workspace: workspace.slug,
            applications: {
                development: applicationIds.development,
                production: applicationIds.production,
            },
            defaultLocale: workspace.defaultLocale,
            locales: workspace.locales,
            slots: {},
            components: {},
            paths: {
                components: '',
                examples: '',
            },
        };

        const sdk = await sdkProvider.get();

        if (sdk === null) {
            await configurationManager.update({
                ...updatedConfiguration,
                paths: {
                    components: 'components',
                    examples: 'examples',
                },
            });

            output.warn('No suitable SDK found, skipping project configuration');

            return;
        }

        await configurationManager.update(
            await this.configure(sdk, {
                ...updatedConfiguration,
                organizationId: organization.id,
                workspaceId: workspace.id,
                applications: applicationIds,
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
            throw new HelpfulError(`No organization found with slug "${organizationSlug}".`, {
                reason: ErrorReason.INVALID_INPUT,
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
            throw new HelpfulError(`No workspace found with slug "${workspaceSlug}".`, {
                reason: ErrorReason.INVALID_INPUT,
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

    private async configure(sdk: Sdk, configuration: ResolvedConfiguration): Promise<ProjectConfiguration> {
        const {skipConfirmation} = this.config;
        const updatedConfiguration: ResolvedConfiguration = {
            ...configuration,
            slots: await this.getSlots(configuration.organization, configuration.workspace),
        };

        return sdk.install({
            input: this.config.io.input === undefined || await skipConfirmation.get()
                ? undefined
                : this.config.io.input,
            output: this.config.io.output,
            configuration: updatedConfiguration,
        });
    }
}
