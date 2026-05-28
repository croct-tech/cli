import {resolve} from 'path';
import type {
    NuxtStoryblokPluginConfiguration,
} from '@/application/project/code/transformation/javascript/nuxtStoryblokPluginCodemod';
import {
    NuxtStoryblokPluginCodemod,
} from '@/application/project/code/transformation/javascript/nuxtStoryblokPluginCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {loadFixtures} from '../fixtures';

describe('NuxtStoryblokPluginCodemod', () => {
    const defaultOptions: NuxtStoryblokPluginConfiguration = {
        plugin: {
            module: '@croct/plug-storyblok/nuxt',
            factory: 'withCroct',
        },
        storyblokVueModule: '@storyblok/vue',
        nuxtAppModule: '#app',
    };

    const scenarios = loadFixtures<NuxtStoryblokPluginConfiguration>(
        resolve(__dirname, '../fixtures/nuxt-storyblok-plugin'),
        defaultOptions,
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript', 'jsx'],
            codemod: new NuxtStoryblokPluginCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
