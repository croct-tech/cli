import {resolve} from 'path';
import {MiddlewareConfiguration, ConfigureMiddleware} from '@/application/project/sdk/code/nextjs/configureMiddleware';
import {loadFixtures} from '../fixtures';
import {ParseCode} from '@/application/project/sdk/code/parseCode';

describe('ConfigureMiddleware', () => {
    const defaultOptions: MiddlewareConfiguration = {
        import: {
            module: '@croct/plug-next/middleware',
            middlewareFactoryName: 'withCroct',
            middlewareName: 'middleware',
            matcherName: 'matcher',
            matcherLocalName: 'matcher',
            configName: 'config',
        },
    };

    const scenarios = loadFixtures<MiddlewareConfiguration>(
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
