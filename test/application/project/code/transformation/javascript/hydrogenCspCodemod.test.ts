import {resolve} from 'path';
import type {HydrogenCspConfiguration} from '@/application/project/code/transformation/javascript/hydrogenCspCodemod';
import {HydrogenCspCodemod} from '@/application/project/code/transformation/javascript/hydrogenCspCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {loadFixtures} from '../fixtures';

describe('HydrogenCspCodemod', () => {
    const defaultOptions: HydrogenCspConfiguration = {
        origin: 'https://api.croct.io',
    };

    const scenarios = loadFixtures<HydrogenCspConfiguration>(
        resolve(__dirname, '../fixtures/hydrogen-csp'),
        defaultOptions,
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new HydrogenCspCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
