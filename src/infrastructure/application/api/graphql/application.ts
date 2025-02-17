import {GraphqlClient} from '@/infrastructure/graphql';
import {ApplicationApi, GeneratedApiKey, NewApiKey} from '@/application/api/application';
import {ApiKeyPermission as GraphqlApiKeyPermission} from '@/infrastructure/graphql/schema/graphql';
import {createApiKeyMutation} from '@/infrastructure/application/api/graphql/queries/application';
import {ApiKeyPermission} from '@/application/model/application';

export class GraphqlApplicationApi implements ApplicationApi {
    private readonly client: GraphqlClient;

    public constructor(client: GraphqlClient) {
        this.client = client;
    }

    public async createApiKey(key: NewApiKey): Promise<GeneratedApiKey> {
        const {data} = await this.client.execute(createApiKeyMutation, {
            applicationId: key.applicationId,
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
