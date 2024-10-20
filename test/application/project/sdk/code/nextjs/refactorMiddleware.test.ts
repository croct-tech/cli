import {resolve} from 'path';
import {MiddlewareOptions, RefactorMiddleware} from '@/application/project/sdk/code/nextjs/refactorMiddleware';
import {loadFixtures} from '../fixtures';
import {ParseCode} from '@/application/project/sdk/code/parseCode';

describe('RefactorMiddleware', () => {
    const defaultOptions: MiddlewareOptions = {
        import: {
            module: '@croct/plug-next/middleware',
            functionName: 'withCroct',
            matcherName: 'matcher',
            matcherLocalName: 'matcher',
        },
    };

    const scenarios = loadFixtures<MiddlewareOptions>(
        resolve(__dirname, '../fixtures/middleware'),
        defaultOptions,
        {
            'matcherAlias.ts': {
                import: {
                    ...defaultOptions.import,
                    matcherLocalName: 'croctMatcher',
                },
            },
        },
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new ParseCode({
            languages: ['typescript'],
            codemod: new RefactorMiddleware(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
