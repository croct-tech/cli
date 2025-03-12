import {resolve} from 'path';
import {
    MiddlewareConfiguration,
    NextJsMiddlewareConfiguratorCodemod,
} from '@/application/project/code/codemod/javascript/nextJsMiddlewareConfiguratorCodemod';
import {loadFixtures} from '../fixtures';
import {JavaScriptCodemod} from '@/application/project/code/codemod/javascript/javaScriptCodemod';

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
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new NextJsMiddlewareConfiguratorCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
