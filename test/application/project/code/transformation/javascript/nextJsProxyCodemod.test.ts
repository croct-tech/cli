import {resolve} from 'path';
import {
    ProxyConfiguration,
    NextJsProxyCodemod,
} from '@/application/project/code/transformation/javascript/nextJsProxyCodemod';
import {loadFixtures} from '../fixtures';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';

describe('NextJsProxyCodemod', () => {
    const defaultOptions: ProxyConfiguration = {
        matcherPattern: '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
        exportName: 'proxy',
        import: {
            module: '@croct/plug-next/proxy',
            proxyFactoryName: 'withCroct',
            proxyName: 'proxy',
        },
    };

    const scenarios = loadFixtures<ProxyConfiguration>(
        resolve(__dirname, '../fixtures/nextjs-proxy'),
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
            codemod: new NextJsProxyCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
