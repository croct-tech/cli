import {resolve} from 'path';
import {loadFixtures} from '../fixtures';
import {JavaScriptCodemod} from '@/application/project/code/codemod/javascript/javaScriptCodemod';
import {
    NextJsLayoutComponentCodemod,
    LayoutComponentOptions,
} from '@/application/project/code/codemod/javascript/nextJsLayoutComponentCodemod';

describe('CreateLayoutComponent', () => {
    const scenarios = loadFixtures<LayoutComponentOptions>(
        resolve(__dirname, '../fixtures/nextjs-layout-component'),
        {},
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript', 'jsx'],
            codemod: new NextJsLayoutComponentCodemod({
                provider: {
                    component: 'CroctProvider',
                    module: '@croct/plug-next/CroctProvider',
                },
            }),
        });

        const output = await transformer.apply(fixture, {
            typescript: name.endsWith('.tsx'),
        });

        expect(output.result).toMatchSnapshot(name);
    });
});
