import {resolve} from 'path';
import type {VueStoryblokConfiguration} from '@/application/project/code/transformation/javascript/vueStoryblokCodemod';
import {VueStoryblokCodemod} from '@/application/project/code/transformation/javascript/vueStoryblokCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {loadFixtures} from '../fixtures';

describe('VueStoryblokCodemod', () => {
    const defaultOptions: VueStoryblokConfiguration = {
        plugin: {
            module: '@croct/plug-storyblok/vue',
            factory: 'withCroct',
        },
        storyblok: {
            module: '@storyblok/vue',
            identifier: 'StoryblokVue',
        },
    };

    const scenarios = loadFixtures<VueStoryblokConfiguration>(
        resolve(__dirname, '../fixtures/vue-storyblok'),
        defaultOptions,
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new VueStoryblokCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
