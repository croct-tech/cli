import {WorkspaceApi} from '@/application/api/workspace';
import {ApplicationApi} from '@/application/api/application';
import {
    ProjectConfiguration,
    ProjectConfigurationManager,
    ResolvedProjectConfiguration,
} from '@/application/project/configuration';
import {CliError} from '@/application/cli/error';
import {UserApi} from '@/application/api/user';
import {OrganizationApi} from '@/application/api/organization';
import {Output} from '@/application/cli/io/output';

export type Configuration = {
    file: ProjectConfigurationFile,
    api: {
        user: UserApi,
        organization: OrganizationApi,
        workspace: WorkspaceApi,
        application: ApplicationApi,
    },
    output: Output,
};

export interface ProjectConfigurationFile {
    load(): Promise<ProjectConfiguration|null>;

    update(configuration: ProjectConfiguration): Promise<void>;
}

export class ConfigurationFileManager implements ProjectConfigurationManager {
    private readonly config: Configuration;

    public constructor(config: Configuration) {
        this.config = config;
    }

    public load(): Promise<ProjectConfiguration | null> {
        const {file} = this.config;

        return file.load();
    }

    public update(configuration: ProjectConfiguration): Promise<void> {
        const {file} = this.config;

        return file.update(configuration);
    }

    public async resolve(): Promise<ResolvedProjectConfiguration> {
        const configuration = await this.load();

        if (configuration === null) {
            throw new CliError('Configuration file not found.', {
                // @todo add link to init documentation
                suggestions: [
                    'Run `init` command to initialize the project',
                ],
            });
        }

        const {output} = this.config;

        const notifier = output.notify('Loading configuration');

        try {
            return await this.loadConfiguration(configuration);
        } finally {
            notifier.stop();
        }
    }

    private async loadConfiguration(configuration: ProjectConfiguration): Promise<ResolvedProjectConfiguration> {
        const {api} = this.config;

        const organization = (await api.user.getOrganizations())
            .find(candidate => candidate.slug === configuration.organization);

        if (organization === undefined) {
            throw new CliError('Project\'s organization not found.', {
                suggestions: [
                    'Check if you have access to the organization',
                    'Run `init` command to reconfigure the project',
                ],
            });
        }

        const workspace = (await api.organization.getWorkspaces({organizationSlug: organization.slug}))
            .find(candidate => candidate.slug === configuration.workspace);

        if (workspace === undefined) {
            throw new CliError('Project\'s workspace not found.', {
                suggestions: [
                    'Check if you have access to the workspace',
                    'Run `init` command to reconfigure the project',
                ],
            });
        }

        const applications = (await api.workspace.getApplications({
            organizationSlug: organization.slug,
            workspaceSlug: workspace.slug,
        }));

        const developmentApplication = applications.find(app => app.slug === configuration.applications.development);

        if (developmentApplication === undefined) {
            throw new CliError('Project\'s development application not found.', {
                suggestions: [
                    'Check if you have access to the application',
                    'Run `init` command to reconfigure the project',
                ],
            });
        }

        const productionApplication = applications.find(app => app.slug === configuration.applications.production);

        if (productionApplication === undefined) {
            throw new CliError('Project\'s production application not found.', {
                suggestions: [
                    'Check if you have access to the application',
                    'Run `init` command to reconfigure the project',
                ],
            });
        }

        return {
            ...configuration,
            organizationId: organization.id,
            workspaceId: workspace.id,
            applications: {
                ...configuration.applications,
                developmentId: developmentApplication.id,
                developmentPublicId: developmentApplication.publicId,
                productionId: productionApplication.id,
                productionPublicId: productionApplication.publicId,
            },
        };
    }
}
