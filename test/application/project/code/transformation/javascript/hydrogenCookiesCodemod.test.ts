import {resolve} from 'path';
import type {
    HydrogenCookiesConfiguration,
} from '@/application/project/code/transformation/javascript/hydrogenCookiesCodemod';
import {HydrogenCookiesCodemod} from '@/application/project/code/transformation/javascript/hydrogenCookiesCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {loadFixtures} from '../fixtures';

describe('HydrogenCookiesCodemod', () => {
    const defaultOptions: HydrogenCookiesConfiguration = {
        writer: {
            moduleName: '@croct/plug-hydrogen/server',
            importName: 'writeCroctCookies',
        },
    };

    const scenarios = loadFixtures<HydrogenCookiesConfiguration>(
        resolve(__dirname, '../fixtures/hydrogen-cookies'),
        defaultOptions,
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new HydrogenCookiesCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
