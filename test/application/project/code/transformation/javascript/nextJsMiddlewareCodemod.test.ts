import {resolve} from 'path';
import {
    MiddlewareConfiguration,
    NextJsMiddlewareCodemod,
} from '@/application/project/code/transformation/javascript/nextJsMiddlewareCodemod';
import {loadFixtures} from '../fixtures';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';

describe('NextJsMiddlewareCodemod', () => {
    const defaultOptions: MiddlewareConfiguration = {
        matcherPattern: '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
        import: {
            module: '@croct/plug-next/middleware',
            middlewareFactoryName: 'withCroct',
            middlewareName: 'middleware',
        },
    };

    const scenarios = loadFixtures<MiddlewareConfiguration>(
        resolve(__dirname, '../fixtures/nextjs-middleware'),
        defaultOptions,
        {
            'matcherAlias.ts': {
                import: {
                    ...defaultOptions.import,
                },
            },
        },
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new NextJsMiddlewareCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
