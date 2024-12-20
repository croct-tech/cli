import {GraphqlClient} from '@/infrastructure/graphql';
import {ApplicationApi, GeneratedApiKey, NewApiKey} from '@/application/api/application';
import {ApiKeyPermission} from '@/infrastructure/graphql/schema/graphql';
import {createApiKeyMutation} from '@/infrastructure/application/api/graphql/queries/application';

export class GraphqlApplicationApi implements ApplicationApi {
    private readonly client: GraphqlClient;

    public constructor(client: GraphqlClient) {
        this.client = client;
    }

    public async createApiKey(key: NewApiKey): Promise<GeneratedApiKey> {
        const permissions: ApiKeyPermission[] = [];

        if (key.permissions.tokenIssue === true) {
            permissions.push(ApiKeyPermission.TokenIssue);
        }

        if (key.permissions.dataExport === true) {
            permissions.push(ApiKeyPermission.DataExport);
        }

        const {data} = await this.client.execute(createApiKeyMutation, {
            applicationId: key.applicationId,
            payload: {
                name: key.name,
                permissions: permissions,
            },
        });

        const {apiKey} = data.createApiKey;

        return {
            id: apiKey.id,
            name: apiKey.name,
            permissions: {
                tokenIssue: permissions.includes(ApiKeyPermission.TokenIssue),
                dataExport: permissions.includes(ApiKeyPermission.DataExport),
            },
            secret: data.createApiKey.apiKeyValue,
        };
    }
}
