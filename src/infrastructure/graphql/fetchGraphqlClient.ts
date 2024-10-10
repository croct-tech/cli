import {TypedDocumentString} from '@/infrastructure/graphql/schema/graphql';
import {GraphqlClient, GraphqlResponse} from '@/infrastructure/graphql/client';
import {TokenProvider} from '@/application/cli/authentication/authenticator';
import {ApiError, Problem} from '@/application/api/error';

export type Configuration = {
    endpoint: string,
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
                        ? {cookie: `__croctApi=${token};`}
                        : {}
                ),
            },
            body: JSON.stringify({
                query: query,
                variables: variables,
            }),
        });

        if (!response.ok) {
            throw new ApiError('Failed to fetch GraphQL API.');
        }

        return response.json().then(({data, errors}: GraphqlResponseBody<TResult>) => {
            if (errors !== undefined) {
                throw new ApiError(errors[0].message, errors.map(({extensions}) => extensions));
            }

            return {
                data: data,
                headers: response.headers,
            };
        });
    }
}
