import {WorkspaceApi} from '@/application/api/workspace';
import {
    ConfigurationError,
    ProjectConfiguration,
    ResolvedConfiguration,
} from '@/application/project/configuration/projectConfiguration';
import {UserApi} from '@/application/api/user';
import {OrganizationApi} from '@/application/api/organization';
import {Output} from '@/application/cli/io/output';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';
import {ConfigurationFile} from '@/application/project/configuration/file/configurationFile';
import {ErrorReason, HelpfulError} from '@/application/error';
import {ApiError} from '@/application/api/error';
import {Application} from '@/application/model/application';

export type Configuration = {
    file: ConfigurationFile,
    api: {
        user: UserApi,
        organization: OrganizationApi,
        workspace: WorkspaceApi,
    },
    output: Output,
};

type ApplicationInfo = Pick<Application, 'slug' | 'id' | 'publicId'>;

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

        const developmentAppSlug = configuration.applications.development;
        const productionAppSlug = configuration.applications.production;

        const [developmentApplication, productionApplication] = await Promise.all([
            api.workspace
                .getApplication({
                    organizationSlug: organization.slug,
                    workspaceSlug: workspace.slug,
                    applicationSlug: developmentAppSlug,
                })
                .catch(error => ConfigurationFileManager.getDeferredInfo(error, developmentAppSlug)),
            productionAppSlug !== undefined
                ? api.workspace
                    .getApplication({
                        organizationSlug: organization.slug,
                        workspaceSlug: workspace.slug,
                        applicationSlug: productionAppSlug,
                    })
                    .catch(error => ConfigurationFileManager.getDeferredInfo(error, productionAppSlug))
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

        let applicationIds: ResolvedConfiguration['applications'] = Object.defineProperties(
            {} as ResolvedConfiguration['applications'],
            {
                development: Object.getOwnPropertyDescriptor(developmentApplication, 'slug')!,
                developmentId: Object.getOwnPropertyDescriptor(developmentApplication, 'id')!,
                developmentPublicId: Object.getOwnPropertyDescriptor(developmentApplication, 'publicId')!,
            },
        );

        if ('production' in configuration.applications && productionApplication !== null) {
            applicationIds = Object.defineProperties(
                applicationIds,
                {
                    production: Object.getOwnPropertyDescriptor(productionApplication, 'slug')!,
                    productionId: Object.getOwnPropertyDescriptor(productionApplication, 'id')!,
                    productionPublicId: Object.getOwnPropertyDescriptor(productionApplication, 'publicId')!,
                },
            );
        }

        return {
            ...configuration,
            organizationId: organization.id,
            workspaceId: workspace.id,
            applications: applicationIds,
        };
    }

    private static getDeferredInfo(error: unknown, slug: string): ApplicationInfo {
        if (!(error instanceof ApiError) || !error.isAccessDenied()) {
            throw error;
        }

        const report = (): never => {
            throw new ConfigurationError(`Access denied to the application "${slug}".`, {
                reason: ErrorReason.ACCESS_DENIED,
                cause: error,
                suggestions: [
                    'Check if the your user or API key has access to the application.',
                ],
            });
        };

        return {
            slug: slug,
            get publicId(): string {
                return report();
            },
            get id(): string {
                return report();
            },
        };
    }
}
