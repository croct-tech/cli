import type {TypedDocumentString} from '@/infrastructure/graphql/schema/graphql';
import type {GraphqlClient, GraphqlResponse} from '@/infrastructure/graphql/client';
import type {TokenProvider} from '@/application/cli/authentication/authenticator';
import type {Problem} from '@/application/api/error';
import {ApiError} from '@/application/api/error';

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

        const {data, errors} = await FetchGraphqlClient.parseBody<TResult>(response);

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
    }

    private static async parseBody<TResult>(response: Response): Promise<GraphqlResponseBody<TResult>> {
        const body = await response.text();

        let payload: unknown;

        try {
            payload = JSON.parse(body);
        } catch {
            payload = null;
        }

        if (typeof payload !== 'object' || payload === null) {
            throw new ApiError(body);
        }

        return payload as GraphqlResponseBody<TResult>;
    }
}
