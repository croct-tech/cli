import {TypedDocumentString} from '@/infrastructure/graphql/schema/graphql';

export type GraphqlResponse<R> = {
    data: R,
    headers: Headers,
};

export interface GraphqlClient {
    execute<TResult, TVariables>(
        query: TypedDocumentString<TResult, TVariables>,
        ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
    ): Promise<GraphqlResponse<TResult>>;
}
