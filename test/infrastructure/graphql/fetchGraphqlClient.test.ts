import {TypedDocumentString} from '@/infrastructure/graphql/schema/graphql';
import {FetchGraphqlClient} from '@/infrastructure/graphql/fetchGraphqlClient';
import {ApiError, ProblemType} from '@/application/api/error';

describe('A fetch GraphQL client', () => {
    const endpoint = new URL('https://example.com/graphql');

    type TestResult = {
        greeting: string,
    };

    const query = new TypedDocumentString<TestResult, Record<string, never>>('query Test { greeting }');

    it('should return the data from a valid payload', async () => {
        jest.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({
                data: {
                    greeting: 'Hello',
                },
            }),
        );

        const client = new FetchGraphqlClient({endpoint: endpoint});

        await expect(client.execute(query)).resolves.toEqual({
            headers: expect.any(Headers),
            data: {
                greeting: 'Hello',
            },
        });
    });

    it('should use the token provider and send the token', async () => {
        const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({
                data: {
                    greeting: 'Hello',
                },
            }),
        );

        const getToken = jest.fn().mockResolvedValue('token-value');

        const client = new FetchGraphqlClient({
            endpoint: endpoint,
            tokenProvider: {getToken: getToken},
        });

        await client.execute(query);

        expect(getToken).toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledWith(
            endpoint,
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer token-value',
                }),
            }),
        );
    });

    type MalformedBodyScenario = {
        body: string,
        status: number,
    };

    it.each<[string, MalformedBodyScenario]>(
        Object.entries<MalformedBodyScenario>({
            'report a gateway error as it came': {
                body: 'upstream connect error or disconnect/reset before headers. '
                    + 'reset reason: connection termination',
                status: 503,
            },
            'report an HTML error page as it came': {
                body: '<html><body><h1>502 Bad Gateway</h1></body></html>',
                status: 502,
            },
            'report an empty body as it came': {
                body: '',
                status: 500,
            },
            'report a payload that is not an object as it came': {
                body: 'null',
                status: 200,
            },
        }),
    )('should %s', async (_, scenario) => {
        const {body, status} = scenario;

        jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, {status: status}));

        const client = new FetchGraphqlClient({endpoint: endpoint});

        const error = await client.execute(query).catch(reason => reason);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.message).toBe(body);
    });

    it('should report the errors of a non-successful response', async () => {
        jest.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json(
                {
                    errors: [
                        {
                            message: 'Invalid input',
                            extensions: {
                                type: ProblemType.INVALID_INPUT,
                                title: 'Invalid input',
                                detail: 'Cannot query field "greeting" on type "Query".',
                                status: 400,
                            },
                        },
                    ],
                },
                {status: 400},
            ),
        );

        const client = new FetchGraphqlClient({endpoint: endpoint});

        const error = await client.execute(query).catch(reason => reason);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.message).toBe('Invalid input');
        expect(error.isErrorType(ProblemType.INVALID_INPUT)).toBe(true);
        expect(error.problems[0].detail).toBe('Cannot query field `greeting` on type `Query`.');
    });
});
