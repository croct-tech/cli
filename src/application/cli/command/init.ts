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
import {
    ProjectConfiguration,
    ProjectConfigurationFile,
    ResolvedProjectConfiguration,
} from '@/application/project/configuration';
import {OrganizationOptions} from '@/application/cli/form/organization/organizationForm';
import {ApplicationOptions} from '@/application/cli/form/application/applicationForm';
import {WorkspaceOptions} from '@/application/cli/form/workspace/workspaceForm';
import {Form} from '@/application/cli/form/form';
import {Version} from '@/application/project/version';

export type InitInput = {
    override?: boolean,
    sdk?: string,
    new?: 'organization' | 'workspace' | 'application',
};

export type InitOutput = ProjectConfiguration;

export type InitConfig = {
    workspaceApi: WorkspaceApi,
    sdkResolver: SdkResolver,
    configurationFile: ProjectConfigurationFile,
    form: {
        organization: Form<Organization, OrganizationOptions>,
        workspace: Form<Workspace, WorkspaceOptions>,
        application: Form<Application, ApplicationOptions>,
    },
    io: {
        input: Input,
        output: Output,
    },
};

export class InitCommand implements Command<InitInput, InitOutput> {
    private readonly config: InitConfig;

    public constructor(config: InitConfig) {
        this.config = config;
    }

    public async execute(input: InitInput): Promise<InitOutput> {
        const {output} = this.config.io;

        const sdk = await this.getSdk(input.sdk);

        output.inform(`Using ${ApplicationPlatform.getName(sdk.getPlatform())} SDK`);

        const {configurationFile, form} = this.config;

        const currentConfiguration = await configurationFile.load();

        if (currentConfiguration !== null && input.override !== true) {
            output.inform('Project already initialized, pass --override to reconfigure');

            return currentConfiguration;
        }

        const organization = await form.organization.handle({
            new: input.new === 'organization',
            default: currentConfiguration?.organization,
        });

        const workspace = await form.workspace.handle({
            organization: organization,
            new: input.new === 'workspace',
            default: currentConfiguration?.workspace,
        });

        const applicationOptions: Omit<ApplicationOptions, 'environment'> = {
            organization: organization,
            workspace: workspace,
            platform: sdk.getPlatform(),
            new: input.new === 'application',
        };

        const applications = {
            development: await form.application.handle({
                ...applicationOptions,
                environment: ApplicationEnvironment.DEVELOPMENT,
                default: currentConfiguration?.applications.development,
            }),
            production: await form.application.handle({
                ...applicationOptions,
                environment: ApplicationEnvironment.PRODUCTION,
                default: currentConfiguration?.applications.production,
            }),
        };

        const configuration = await this.configure(sdk, {
            organization: organization.slug,
            organizationId: organization.id,
            workspace: workspace.slug,
            workspaceId: workspace.id,
            applications: {
                production: applications.production.slug,
                productionId: applications.production.id,
                productionPublicId: applications.production.publicId,
                development: applications.development.slug,
                developmentId: applications.development.id,
                developmentPublicId: applications.development.publicId,
            },
            defaultLocale: workspace.defaultLocale,
            locales: [workspace.defaultLocale],
            slots: {},
            components: {},
        });

        const notifier = output.notify('Updating project configuration');

        await configurationFile.update(configuration);

        notifier.confirm('Configuration updated');

        return configuration;
    }

    private async configure(sdk: Sdk, configuration: ResolvedProjectConfiguration): Promise<ProjectConfiguration> {
        const {configurationFile} = this.config;
        const updatedConfiguration: ResolvedProjectConfiguration = {
            ...configuration,
            slots: await this.getSlots(configuration.organization, configuration.workspace),
        };

        await configurationFile.update(updatedConfiguration);

        return sdk.install({
            input: this.config.io.input,
            output: this.config.io.output,
            configuration: updatedConfiguration,
        });
    }

    private async getSlots(organizationSlug: string, workspaceSlug: string): Promise<Record<string, Version>> {
        const {workspaceApi, io: {output}} = this.config;

        const notifier = output.notify('Loading slots');

        const slots = await workspaceApi.getSlots({
            organizationSlug: organizationSlug,
            workspaceSlug: workspaceSlug,
        });

        notifier.stop();

        return Object.fromEntries(slots.map(slot => [slot.slug, Version.of(slot.version.major)]));
    }

    private async getSdk(hint?: string): Promise<Sdk> {
        const {output} = this.config.io;
        const {sdkResolver} = this.config;

        const notifier = output.notify('Resolving SDK');

        const sdk = await sdkResolver.resolve(hint);

        if (sdk === null) {
            notifier.alert('No supported SDK found.');

            return output.exit();
        }

        notifier.stop();

        return sdk;
    }
}
