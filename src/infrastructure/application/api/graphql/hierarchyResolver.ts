import {CacheProvider} from '@croct/cache';
import {GraphqlClient} from '@/infrastructure/graphql';
import {ApiError} from '@/application/api/error';
import {ErrorReason} from '@/application/error';
import {resourceIdQuery} from '@/infrastructure/application/api/graphql/queries/organization';

export type OrganizationHierarchy = {
    organizationId: string,
};

export type WorkspaceHierarchy = OrganizationHierarchy & {
    workspaceId: string,
};

export type ApplicationHierarchy = WorkspaceHierarchy & {
    applicationId: string,
};

type ResourceHierarchy = ApplicationHierarchy | WorkspaceHierarchy | OrganizationHierarchy;

export type OrganizationPath = {
    organizationSlug: string,
};

export type WorkspacePath = OrganizationPath & {
    workspaceSlug: string,
};

export type ApplicationPath = WorkspacePath & {
    applicationSlug: string,
};

export type ResourcePath = OrganizationPath | WorkspacePath | ApplicationPath;

export class HierarchyResolver {
    private readonly client: GraphqlClient;

    private readonly cache: CacheProvider<string, ResourceHierarchy>;

    public constructor(client: GraphqlClient, cache: CacheProvider<string, ResourceHierarchy>) {
        this.client = client;
        this.cache = cache;
    }

    public getHierarchy(path: OrganizationPath): Promise<OrganizationHierarchy>;

    public getHierarchy(path: WorkspacePath): Promise<WorkspaceHierarchy>;

    public getHierarchy(path: ApplicationPath): Promise<ApplicationHierarchy>;

    public getHierarchy(path: ResourcePath): Promise<ResourceHierarchy> {
        return this.cache.get(HierarchyResolver.getHierarchyKey(path), async () => {
            const hierarchy = await this.resolveHierarchy(path);

            await this.saveCache(path, hierarchy);

            return hierarchy;
        });
    }

    private async resolveHierarchy(path: ResourcePath): Promise<ResourceHierarchy> {
        const {data: {organization}} = await this.client.execute(resourceIdQuery, path);

        const organizationId = organization?.id;
        const workspaceId = organization?.workspace?.id;
        const applicationId = organization?.workspace?.application?.id;

        HierarchyResolver.checkMissing('organization', path.organizationSlug, organizationId);

        if (!('workspaceSlug' in path)) {
            return {organizationId: organizationId};
        }

        HierarchyResolver.checkMissing('workspace', path.workspaceSlug, workspaceId);

        if (!('applicationSlug' in path)) {
            return {
                organizationId: organizationId,
                workspaceId: workspaceId,
            };
        }

        HierarchyResolver.checkMissing('application', path.applicationSlug, applicationId);

        return {
            organizationId: organizationId,
            workspaceId: workspaceId,
            applicationId: applicationId,
        };
    }

    private async saveCache(path: ResourcePath, hierarchy: ResourceHierarchy): Promise<void> {
        const promises: Array<Promise<void>> = [
            this.setCache({organizationSlug: path.organizationSlug}, {organizationId: hierarchy.organizationId}),
        ];

        if ('workspaceId' in hierarchy && 'workspaceSlug' in path) {
            promises.push(
                this.setCache(
                    {
                        organizationSlug: path.organizationSlug,
                        workspaceSlug: path.workspaceSlug,
                    },
                    {
                        organizationId: hierarchy.organizationId,
                        workspaceId: hierarchy.workspaceId,
                    },
                ),
            );
        }

        if ('applicationId' in hierarchy && 'applicationSlug' in path) {
            promises.push(
                this.setCache(
                    {
                        organizationSlug: path.organizationSlug,
                        workspaceSlug: path.workspaceSlug,
                        applicationSlug: path.applicationSlug,
                    },
                    {
                        organizationId: hierarchy.organizationId,
                        workspaceId: hierarchy.workspaceId,
                        applicationId: hierarchy.applicationId,
                    },
                ),
            );
        }

        await Promise.all(promises);
    }

    private setCache(path: ResourcePath, hierarchy: ResourceHierarchy): Promise<void> {
        return this.cache.set(HierarchyResolver.getHierarchyKey(path), hierarchy);
    }

    private static getHierarchyKey(path: ResourcePath): string {
        const slugs: string[] = [`organization:${path.organizationSlug}`];

        if ('workspaceSlug' in path) {
            slugs.push(`workspace:${path.workspaceSlug}`);
        }

        if ('applicationSlug' in path) {
            slugs.push(`application${path.applicationSlug}`);
        }

        return slugs.join('/');
    }

    private static checkMissing(resource: string, slug: string, id: string | undefined): asserts id is string {
        if (id === undefined) {
            throw new ApiError(`No ${resource} found with slug "${slug}".`, [], {
                reason: ErrorReason.NOT_FOUND,
            });
        }
    }
}
