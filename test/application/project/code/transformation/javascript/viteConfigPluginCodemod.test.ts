import {resolve} from 'path';
import type {
    ViteConfigPluginConfiguration,
} from '@/application/project/code/transformation/javascript/viteConfigPluginCodemod';
import {ViteConfigPluginCodemod} from '@/application/project/code/transformation/javascript/viteConfigPluginCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {loadFixtures} from '../fixtures';

describe('ViteConfigPluginCodemod', () => {
    const defaultOptions: ViteConfigPluginConfiguration = {
        plugin: {
            moduleName: '@croct/plug-hydrogen/vite',
            importName: 'croct',
        },
    };

    const scenarios = loadFixtures<ViteConfigPluginConfiguration>(
        resolve(__dirname, '../fixtures/vite-config-plugin'),
        defaultOptions,
        {
            'positionStart.ts': {
                ...defaultOptions,
                position: 'start',
            },
        },
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new ViteConfigPluginCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });

    it('throws when required and there is no Vite config', async () => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new ViteConfigPluginCodemod({...defaultOptions, required: true}),
        });

        await expect(transformer.apply('export const value = 1;\n')).rejects
            .toThrow('No Vite configuration found');
    });
});
