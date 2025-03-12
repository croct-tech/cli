import {resolve} from 'path';
import {loadFixtures} from '../fixtures';
import {JavaScriptCodemod} from '@/application/project/code/codemod/javascript/javaScriptCodemod';
import {
    AppComponentOptions,
    NextJsAppComponentCodemod,
} from '@/application/project/code/codemod/javascript/nextJsAppComponentCodemod';

describe('CreateAppComponent', () => {
    const scenarios = loadFixtures<AppComponentOptions>(
        resolve(__dirname, '../fixtures/nextjs-app-component'),
        {},
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript', 'jsx'],
            codemod: new NextJsAppComponentCodemod({
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
