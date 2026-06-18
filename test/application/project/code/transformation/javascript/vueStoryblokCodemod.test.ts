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

    it('throws when required and there is no Vue app initialization', async () => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new VueStoryblokCodemod({...defaultOptions, required: true}),
        });

        const source = [
            "import { StoryblokVue } from '@storyblok/vue';",
            '',
            'const app = { use: () => app, mount: () => {} };',
            '',
            "app.use(StoryblokVue, { accessToken: 'YOUR_ACCESS_TOKEN' });",
            "app.mount('#app');",
            '',
        ].join('\n');

        await expect(transformer.apply(source)).rejects
            .toThrow('No Vue app initialization found to wire the Storyblok integration.');
    });

    it('throws when required and there is no Storyblok Vue plugin import', async () => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new VueStoryblokCodemod({...defaultOptions, required: true}),
        });

        const source = [
            "import { createApp } from 'vue';",
            "import { apiPlugin } from '@storyblok/vue';",
            "import App from './App.vue';",
            '',
            'const app = createApp(App);',
            "app.mount('#app');",
            '',
        ].join('\n');

        await expect(transformer.apply(source)).rejects
            .toThrow('No Storyblok Vue plugin import found.');
    });

    it('throws when required and there is no app.use(StoryblokVue) call', async () => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new VueStoryblokCodemod({...defaultOptions, required: true}),
        });

        const source = [
            "import { createApp } from 'vue';",
            "import { StoryblokVue } from '@storyblok/vue';",
            "import App from './App.vue';",
            '',
            'console.log(StoryblokVue);',
            '',
            'const app = createApp(App);',
            "app.mount('#app');",
            '',
        ].join('\n');

        await expect(transformer.apply(source)).rejects
            .toThrow('No app.use(StoryblokVue) call found to wrap.');
    });
});
