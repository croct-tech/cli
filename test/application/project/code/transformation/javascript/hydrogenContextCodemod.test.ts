import {resolve} from 'path';
import type {
    HydrogenContextConfiguration,
} from '@/application/project/code/transformation/javascript/hydrogenContextCodemod';
import {HydrogenContextCodemod} from '@/application/project/code/transformation/javascript/hydrogenContextCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {loadFixtures} from '../fixtures';

describe('HydrogenContextCodemod', () => {
    const defaultOptions: HydrogenContextConfiguration = {
        factory: {
            moduleName: '@croct/plug-hydrogen/server',
            importName: 'createCroctContext',
        },
    };

    const scenarios = loadFixtures<HydrogenContextConfiguration>(
        resolve(__dirname, '../fixtures/hydrogen-context'),
        defaultOptions,
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new HydrogenContextCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });

    it('throws when required and there is no Hydrogen load context', async () => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new HydrogenContextCodemod({...defaultOptions, required: true}),
        });

        await expect(transformer.apply('export function noop() {\n    return 1;\n}\n')).rejects
            .toThrow('No Hydrogen load context found');
    });
});
