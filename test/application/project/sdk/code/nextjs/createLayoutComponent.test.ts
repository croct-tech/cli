import {resolve} from 'path';
import {loadFixtures} from '../fixtures';
import {ParseCode} from '@/application/project/code/codemod/parseCode';
import {
    CreateLayoutComponent,
    LayoutComponentOptions,
} from '@/application/project/code/codemod/nextjs/createLayoutComponent';

describe('CreateLayoutComponent', () => {
    const scenarios = loadFixtures<LayoutComponentOptions>(
        resolve(__dirname, '../fixtures/nextjs-layout-component'),
        {},
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture}) => {
        const transformer = new ParseCode({
            languages: ['typescript', 'jsx'],
            codemod: new CreateLayoutComponent({
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
