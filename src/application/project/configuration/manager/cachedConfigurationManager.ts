import {Configuration, ResolvedConfiguration} from '@/application/project/configuration/configuration';
import {ConfigurationManager} from '@/application/project/configuration/manager/configurationManager';

export class CachedConfigurationManager implements ConfigurationManager {
    private readonly manager: ConfigurationManager;

    private configuration: Promise<Configuration | null> | null = null;

    private resolvedConfiguration: Promise<ResolvedConfiguration> | null = null;

    public constructor(manager: ConfigurationManager) {
        this.manager = manager;
    }

    public load(): Promise<Configuration | null> {
        if (this.configuration === null) {
            const promise = this.manager.load();

            this.configuration = promise;

            promise.catch(() => {
                this.configuration = null;
            });
        }

        return this.configuration;
    }

    public resolve(): Promise<ResolvedConfiguration> {
        if (this.resolvedConfiguration === null) {
            const promise = this.manager.resolve();

            this.resolvedConfiguration = promise;

            promise.catch(() => {
                this.resolvedConfiguration = null;
            });
        }

        return this.resolvedConfiguration;
    }

    public update(configuration: Configuration): Promise<Configuration> {
        const promise = this.manager.update(configuration);

        this.configuration = promise;

        promise.catch(() => {
            this.configuration = null;
        });

        if (this.resolvedConfiguration !== null) {
            this.resolvedConfiguration.then(resolvedConfiguration => {
                if (
                    this.resolvedConfiguration === null
                    && this.configuration === promise
                    && resolvedConfiguration.organization === configuration.organization
                    && resolvedConfiguration.workspace === configuration.workspace
                    && resolvedConfiguration.applications.development === configuration.applications.development
                    && resolvedConfiguration.applications.production === configuration.applications.production
                ) {
                    this.resolvedConfiguration = Promise.resolve({
                        ...configuration,
                        organizationId: resolvedConfiguration.organizationId,
                        workspaceId: resolvedConfiguration.workspaceId,
                        applications: resolvedConfiguration.applications,
                    });
                }
            });

            this.resolvedConfiguration = null;
        }

        return promise;
    }
}
