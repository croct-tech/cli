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
import {ProjectManager} from '@/application/project/projectManager';
import {ProjectConfiguration} from '@/application/model/project';
import {OrganizationOptions} from '@/application/cli/form/organization/organizationForm';
import {ApplicationOptions} from '@/application/cli/form/application/applicationForm';
import {WorkspaceOptions} from '@/application/cli/form/workspace/workspaceForm';
import {Form} from '@/application/cli/form/form';

export type InitInput = {
    override?: boolean,
    sdk?: string,
    new?: 'organization' | 'workspace' | 'application',
};

export type InitOutput = ProjectConfiguration;

export type InitConfig = {
    workspaceApi: WorkspaceApi,
    sdkResolver: SdkResolver,
    projectManager: ProjectManager,
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

        if (sdk === null) {
            throw new Error('No supported SDK found.');
        }

        output.info(`Using Croct SDK for ${ApplicationPlatform.getName(sdk.getPlatform())}`);

        const {projectManager, form} = this.config;

        const currentConfiguration = await projectManager.getConfiguration();

        if (currentConfiguration !== null && input.override !== true) {
            output.info('Project already initialized, pass --override to reconfigure');

            return currentConfiguration;
        }

        const organization = await form.organization.handle({
            new: input.new === 'organization',
        });

        const workspace = await form.workspace.handle({
            organization: organization,
            new: input.new === 'workspace',
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
            }),
            production: await form.application.handle({
                ...applicationOptions,
                environment: ApplicationEnvironment.PRODUCTION,
            }),
        };

        const configuration = await this.configure(sdk, {
            organization: organization.slug,
            workspace: workspace.slug,
            applications: {
                production: applications.production.slug,
                development: applications.development.slug,
            },
            locales: [],
            slots: {},
            components: {},
        });

        await projectManager.updateConfiguration(configuration);

        return configuration;
    }

    private async configure(sdk: Sdk, configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        const {projectManager} = this.config;
        const updatedConfiguration: ProjectConfiguration = {
            ...configuration,
            slots: await this.getSlots(configuration.organization, configuration.workspace),
        };

        await projectManager.updateConfiguration(updatedConfiguration);

        return sdk.install({
            input: this.config.io.input,
            output: this.config.io.output,
            configuration: updatedConfiguration,
        });
    }

    private async getSlots(organizationSlug: string, workspaceSlug: string): Promise<Record<string, string>> {
        const {workspaceApi, io: {output}} = this.config;

        const spinner = output.createSpinner('Loading slots');

        const slots = await workspaceApi.getSlots(organizationSlug, workspaceSlug);

        spinner.stop();

        return Object.fromEntries(slots.map(slot => [slot.slug, `${slot.version.major}.${slot.version.minor}`]));
    }

    private async getSdk(hint?: string): Promise<Sdk|null> {
        const {output} = this.config.io;
        const {sdkResolver} = this.config;

        const spinner = output.createSpinner('Resolving SDK');

        const sdk = await sdkResolver.resolve(hint);

        if (sdk === null) {
            output.error('No supported SDK found.');

            return null;
        }

        spinner.stop();

        return sdk;
    }
}
