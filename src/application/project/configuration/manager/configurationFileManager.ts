import {WorkspaceApi} from '@/application/api/workspace';
import {
    Configuration as ProjectConfiguration,
    ResolvedConfiguration,
} from '@/application/project/configuration/configuration';
import {CliError, CliErrorCode} from '@/application/cli/error';
import {UserApi} from '@/application/api/user';
import {OrganizationApi} from '@/application/api/organization';
import {Output} from '@/application/cli/io/output';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {ConfigurationFile} from '@/application/project/configuration/file/configurationFile';

export type Configuration = {
    file: ConfigurationFile,
    api: {
        user: UserApi,
        organization: OrganizationApi,
        workspace: WorkspaceApi,
    },
    output: Output,
};

export class ConfigurationFileManager implements ConfigurationManager {
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

    public async resolve(): Promise<ResolvedConfiguration> {
        const configuration = await this.load();

        if (configuration === null) {
            throw new CliError('Project configuration not found.', {
                code: CliErrorCode.PRECONDITION,
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

    private async loadConfiguration(configuration: ProjectConfiguration): Promise<ResolvedConfiguration> {
        const {api} = this.config;

        const organization = await api.user.getOrganization(configuration.organization);

        if (organization === null) {
            throw new CliError('Project\'s organization not found.', {
                suggestions: [
                    'Check if you have access to the organization',
                    'Run `init` command to reconfigure the project',
                ],
            });
        }

        const workspace = await api.organization.getWorkspace({
            organizationSlug: organization.slug,
            workspaceSlug: configuration.workspace,
        });

        if (workspace === null) {
            throw new CliError('Project\'s workspace not found.', {
                suggestions: [
                    'Check if you have access to the workspace',
                    'Run `init` command to reconfigure the project',
                ],
            });
        }

        const [developmentApplication, productionApplication] = await Promise.all([
            api.workspace.getApplication({
                organizationSlug: organization.slug,
                workspaceSlug: workspace.slug,
                applicationSlug: configuration.applications.development,
            }),
            api.workspace.getApplication({
                organizationSlug: organization.slug,
                workspaceSlug: workspace.slug,
                applicationSlug: configuration.applications.production,
            }),
        ]);

        if (developmentApplication === null) {
            throw new CliError('Project\'s development application not found.', {
                suggestions: [
                    'Check if you have access to the application',
                    'Run `init` command to reconfigure the project',
                ],
            });
        }

        if (productionApplication === null) {
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
