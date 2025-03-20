import {GraphqlClient} from '@/infrastructure/graphql';
import {ApplicationApi, GeneratedApiKey, NewApiKey} from '@/application/api/application';
import {ApiKeyPermission as GraphqlApiKeyPermission} from '@/infrastructure/graphql/schema/graphql';
import {createApiKeyMutation} from '@/infrastructure/application/api/graphql/queries/application';
import {ApiKeyPermission} from '@/application/model/application';
import {HierarchyResolver} from '@/infrastructure/application/api/graphql/hierarchyResolver';

export class GraphqlApplicationApi implements ApplicationApi {
    private readonly client: GraphqlClient;

    private readonly hierarchyResolver: HierarchyResolver;

    public constructor(client: GraphqlClient, hierarchyResolver: HierarchyResolver) {
        this.client = client;
        this.hierarchyResolver = hierarchyResolver;
    }

    public async createApiKey(key: NewApiKey): Promise<GeneratedApiKey> {
        const hierarchy = await this.hierarchyResolver.getHierarchy({
            organizationSlug: key.organizationSlug,
            workspaceSlug: key.workspaceSlug,
            applicationSlug: key.applicationSlug,
        });

        const {data} = await this.client.execute(createApiKeyMutation, {
            applicationId: hierarchy.applicationId,
            payload: {
                name: key.name,
                permissions: key.permissions as unknown as GraphqlApiKeyPermission[],
            },
        });

        const {apiKey} = data.createApiKey;

        return {
            id: apiKey.id,
            name: apiKey.name,
            permissions: apiKey.permissions.map(ApiKeyPermission.fromValue),
            secret: data.createApiKey.apiKeyValue,
        };
    }
}
