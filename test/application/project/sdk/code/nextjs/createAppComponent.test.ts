import {resolve} from 'path';
import {loadFixtures} from '../fixtures';
import {ParseCode} from '@/application/project/code/codemod/parseCode';
import {AppComponentOptions, CreateAppComponent} from '@/application/project/code/codemod/nextjs/createAppComponent';

describe('CreateAppComponent', () => {
    const scenarios = loadFixtures<AppComponentOptions>(
        resolve(__dirname, '../fixtures/nextjs-app-component'),
        {},
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture}) => {
        const transformer = new ParseCode({
            languages: ['typescript', 'jsx'],
            codemod: new CreateAppComponent({
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
