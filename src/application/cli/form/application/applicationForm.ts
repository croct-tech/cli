import {Input} from '@/application/cli/io/input';
import {Output} from '@/application/cli/io/output';
import {Form} from '@/application/cli/form/form';
import {WorkspaceApi} from '@/application/api/workspace';
import {NameInput} from '@/application/cli/form/input/nameInput';
import {UrlInput} from '@/application/cli/form/input/urlInput';
import {Organization} from '@/application/model/organization';
import {Workspace} from '@/application/model/workspace';
import {Application, ApplicationEnvironment} from '@/application/model/application';
import {Platform} from '@/application/model/platform';

export type Configuration = {
    input: Input,
    output: Output,
    workspaceApi: WorkspaceApi,
};

export type ApplicationOptions = {
    organization: Organization,
    workspace: Workspace,
    platform: Platform,
    environment: ApplicationEnvironment,
    new?: boolean,
    default?: string,
};

export type SelectedApplication = Application & {
    new?: boolean,
};

export class ApplicationForm implements Form<SelectedApplication, ApplicationOptions> {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public async handle(options: ApplicationOptions): Promise<SelectedApplication> {
        const {workspaceApi: api, output, input} = this.config;
        const {organization, workspace, environment} = options;

        const notifier = output.notify('Loading applications');

        const applications = await api.getApplications({
            workspaceSlug: workspace.slug,
            organizationSlug: organization.slug,
        });

        const candidates = applications.filter(
            app => (app.environment === environment && (options.default ?? app.slug) === app.slug),
        );

        notifier.stop();

        if (candidates.length === 0 || options.new === true) {
            return this.setupApplication(options, applications);
        }

        if (candidates.length === 1) {
            const application = candidates[0];

            output.confirm(ApplicationForm.formatSelection(application));

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

    private async setupApplication(
        options: ApplicationOptions,
        applications: Application[],
    ): Promise<SelectedApplication> {
        const {workspaceApi: api, output, input} = this.config;
        const {organization, workspace, platform, environment} = options;
        const customized = options.new === true;

        const name = customized
            ? await NameInput.prompt({
                input: input,
                label: environment === ApplicationEnvironment.DEVELOPMENT
                    ? 'Development application name'
                    : 'Production application name',
                default: 'Website',
                validator: value => applications.every(
                    app => app.name.toLowerCase() !== value.toLowerCase() || app.environment !== environment,
                ) || 'Name already in use',
            })
            : 'Website';

        const defaultWebsite = workspace.website ?? organization.website ?? undefined;

        const website = customized || !ApplicationForm.isValidUrl(defaultWebsite, environment)
            ? await UrlInput.prompt({
                input: input,
                label: environment === ApplicationEnvironment.DEVELOPMENT
                    ? 'Development application URL'
                    : 'Production application URL',
                default: defaultWebsite,
                validate: url => {
                    if (!URL.canParse(url)) {
                        return 'Invalid URL';
                    }

                    if (!ApplicationForm.isValidUrl(url, environment)) {
                        return 'Production URL must not be localhost';
                    }

                    return true;
                },
            })
            : defaultWebsite;

        const notifier = output.notify('Configuring application');

        try {
            const application = await api.createApplication({
                organizationSlug: organization.slug,
                workspaceSlug: workspace.slug,
                name: name,
                website: website,
                environment: environment,
                platform: platform,
                timeZone: workspace.timeZone,
            });

            notifier.confirm(ApplicationForm.formatSelection(application));

            return {
                ...application,
                new: true,
            };
        } finally {
            notifier.stop();
        }
    }

    private static isValidUrl(url: string|undefined, environment: ApplicationEnvironment): url is string {
        if (url === undefined || !URL.canParse(url)) {
            return false;
        }

        return environment !== ApplicationEnvironment.PRODUCTION || new URL(url).hostname !== 'localhost';
    }

    private static formatSelection(application: Application): string {
        return application.environment === ApplicationEnvironment.DEVELOPMENT
            ? `Development application: ${application.name} (${application.slug})`
            : `Production application: ${application.name} (${application.slug})`;
    }
}
