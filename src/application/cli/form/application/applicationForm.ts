import {
    Application,
    ApplicationEnvironment,
    ApplicationPlatform,
    Organization,
    Workspace,
} from '@/application/model/entities';
import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {WorkspaceApi} from '@/application/api/workspace';
import {NameInput} from '@/application/cli/form/input/nameInput';
import {UrlInput} from '@/application/cli/form/input/urlInput';

export type Configuration = {
    input: Input,
    output: Output,
    workspaceApi: WorkspaceApi,
};

export type ApplicationOptions = {
    organization: Organization,
    workspace: Workspace,
    platform: ApplicationPlatform,
    environment: ApplicationEnvironment,
    new?: boolean,
};

export class ApplicationForm implements Form<Application, ApplicationOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: ApplicationOptions): Promise<Application> {
        const {workspaceApi: api, output, input} = this.config;
        const {organization, workspace, environment} = options;

        const spinner = output.createSpinner('Loading applications');

        const applications = await api.getApplications({
            workspaceSlug: workspace.slug,
            organizationSlug: organization.slug,
        });
        const candidates = applications.filter(app => app.environment === environment);

        spinner.stop();

        if (candidates.length === 0 || options.new === true) {
            return this.setupApplication(options, applications);
        }

        if (candidates.length === 1) {
            const application = candidates[0];

            spinner.succeed(ApplicationForm.formatSelection(application));

            return application;
        }

        return input.select({
            message: environment === ApplicationEnvironment.DEVELOPMENT
                ? 'Select development application'
                : 'Select production application',
            options: candidates.map(
                option => ({
                    value: option,
                    label: option.name,
                }),
            ),
        });
    }

    private async setupApplication(options: ApplicationOptions, applications: Application[]): Promise<Application> {
        const {workspaceApi: api, output, input} = this.config;
        const {organization, workspace, platform, environment} = options;
        const customized = options.new === true;

        const name = customized
            ? await NameInput.prompt({
                input: input,
                label: 'Application name',
                default: 'Website',
                validator: value => applications.every(
                    app => app.name.toLowerCase() !== value.toLowerCase() || app.environment !== environment,
                ) || 'Name already in use',
            })
            : 'Website';

        const defaultWebsite = workspace.website ?? organization.website ?? undefined;

        const website = customized || defaultWebsite === undefined
            ? await UrlInput.prompt({
                input: input,
                label: 'Application website',
                default: defaultWebsite,
            })
            : defaultWebsite;

        const spinner = output.createSpinner('Configuring application');

        try {
            const application = await api.createApplication({
                organizationId: organization.id,
                workspaceId: workspace.id,
                name: name,
                website: website,
                environment: environment,
                platform: platform,
                timeZone: workspace.timeZone,
            });

            spinner.succeed(ApplicationForm.formatSelection(application));

            return application;
        } finally {
            spinner.stop();
        }
    }

    private static formatSelection(application: Application): string {
        return application.environment === ApplicationEnvironment.DEVELOPMENT
            ? `Development application: ${application.name} (${application.slug})`
            : `Production application: ${application.name} (${application.slug})`;
    }
}
