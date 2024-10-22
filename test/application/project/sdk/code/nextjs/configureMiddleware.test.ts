import {resolve} from 'path';
import {MiddlewareOptions, ConfigureMiddleware} from '@/application/project/sdk/code/nextjs/configureMiddleware';
import {loadFixtures} from '../fixtures';
import {ParseCode} from '@/application/project/sdk/code/parseCode';

describe('ConfigureMiddleware', () => {
    const defaultOptions: MiddlewareOptions = {
        import: {
            module: '@croct/plug-next/middleware',
            highOrderFunctionName: 'withCroct',
            middlewareFunctionName: 'middleware',
            matcherName: 'matcher',
            matcherLocalName: 'matcher',
            configName: 'config',
        },
    };

    const scenarios = loadFixtures<MiddlewareOptions>(
        resolve(__dirname, '../fixtures/nextjs-middleware'),
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
            codemod: new ConfigureMiddleware(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
