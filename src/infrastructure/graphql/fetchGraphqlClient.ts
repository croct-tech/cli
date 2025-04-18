import {TypedDocumentString} from '@/infrastructure/graphql/schema/graphql';
import {GraphqlClient, GraphqlResponse} from '@/infrastructure/graphql/client';
import {TokenProvider} from '@/application/cli/authentication/authenticator';
import {ApiError, Problem} from '@/application/api/error';

export type Configuration = {
    endpoint: URL,
    tokenProvider?: TokenProvider,
};

type GraphqlResponseBody<TResult> = {
    data: TResult,
    errors?: Array<{
        message: string,
        extensions: Problem,
    }>,
};

export class FetchGraphqlClient implements GraphqlClient {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public async execute<TResult, TVariables>(
        query: TypedDocumentString<TResult, TVariables>,
        ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
    ): Promise<GraphqlResponse<TResult>> {
        const {tokenProvider, endpoint} = this.configuration;
        const token = tokenProvider !== undefined ? await tokenProvider.getToken() : null;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                ...(
                    token !== null
                        ? {Authorization: `Bearer ${token}`}
                        : {}
                ),
            },
            body: JSON.stringify({
                query: query,
                variables: variables,
            }),
        });

        return response.json().then(result => {
            const {data, errors} = result as GraphqlResponseBody<TResult>;

            if (errors !== undefined) {
                throw new ApiError(
                    errors[0].message.replace(/"/g, '`'),
                    errors.map(
                        ({extensions}) => ({
                            ...extensions,
                            detail: extensions.detail?.replace(/"/g, '`'),
                        }),
                    ),
                );
            }

            return {
                data: data,
                headers: response.headers,
            };
        });
    }
}
