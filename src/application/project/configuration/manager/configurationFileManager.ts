import {WorkspaceApi} from '@/application/api/workspace';
import {
    Configuration as ProjectConfiguration,
    ResolvedConfiguration,
} from '@/application/project/configuration/configuration';
import {UserApi} from '@/application/api/user';
import {OrganizationApi} from '@/application/api/organization';
import {Output} from '@/application/cli/io/output';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {ConfigurationFile} from '@/application/project/configuration/file/configurationFile';
import {HelpfulError, ErrorReason} from '@/application/error';

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

    public update(configuration: ProjectConfiguration): Promise<ProjectConfiguration> {
        const {file} = this.config;

        return file.update(configuration);
    }

    public async resolve(): Promise<ResolvedConfiguration> {
        const configuration = await this.load();

        if (configuration === null) {
            throw new HelpfulError('Project configuration not found.', {
                reason: ErrorReason.PRECONDITION,
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
            throw new HelpfulError('Project\'s organization not found.', {
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
            throw new HelpfulError('Project\'s workspace not found.', {
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
            configuration.applications.production !== undefined
                ? api.workspace.getApplication({
                    organizationSlug: organization.slug,
                    workspaceSlug: workspace.slug,
                    applicationSlug: configuration.applications.production,
                })
                : Promise.resolve(null),
        ]);

        if (developmentApplication === null) {
            throw new HelpfulError('Project\'s development application not found.', {
                suggestions: [
                    'Check if you have access to the application',
                    'Run `init` command to reconfigure the project',
                ],
            });
        }

        if (productionApplication === null && configuration.applications.production !== undefined) {
            throw new HelpfulError('Project\'s production application not found.', {
                suggestions: [
                    'Check if you have access to the application',
                    'Run `init` command to reconfigure the project',
                ],
            });
        }

        let applicationIds: ResolvedConfiguration['applications'] = {
            development: developmentApplication.slug,
            developmentId: developmentApplication.id,
            developmentPublicId: developmentApplication.publicId,
        };

        if ('production' in configuration.applications && productionApplication !== null) {
            applicationIds = {
                ...applicationIds,
                production: productionApplication.slug,
                productionId: productionApplication.id,
                productionPublicId: productionApplication.publicId,
            };
        }

        return {
            ...configuration,
            organizationId: organization.id,
            workspaceId: workspace.id,
            applications: applicationIds,
        };
    }
}
