import {resolve} from 'path';
import type {
    NuxtConfigModuleConfiguration,
} from '@/application/project/code/transformation/javascript/nuxtConfigModuleCodemod';
import {NuxtConfigModuleCodemod} from '@/application/project/code/transformation/javascript/nuxtConfigModuleCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {loadFixtures} from '../fixtures';

describe('NuxtConfigModuleCodemod', () => {
    const defaultOptions: NuxtConfigModuleConfiguration = {
        moduleName: '@croct/plug-nuxt',
    };

    const scenarios = loadFixtures<NuxtConfigModuleConfiguration>(
        resolve(__dirname, '../fixtures/nuxt-config-module'),
        defaultOptions,
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript', 'jsx'],
            codemod: new NuxtConfigModuleCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
