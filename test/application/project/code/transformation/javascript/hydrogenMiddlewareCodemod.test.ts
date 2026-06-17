import {resolve} from 'path';
import type {
    HydrogenMiddlewareConfiguration,
} from '@/application/project/code/transformation/javascript/hydrogenMiddlewareCodemod';
import {
    HydrogenMiddlewareCodemod,
} from '@/application/project/code/transformation/javascript/hydrogenMiddlewareCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {loadFixtures} from '../fixtures';

describe('HydrogenMiddlewareCodemod', () => {
    const defaultOptions: HydrogenMiddlewareConfiguration = {
        middleware: {
            moduleName: '@croct/plug-hydrogen/server',
            importName: 'createCroctMiddleware',
        },
    };

    const scenarios = loadFixtures<HydrogenMiddlewareConfiguration>(
        resolve(__dirname, '../fixtures/hydrogen-middleware'),
        defaultOptions,
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new HydrogenMiddlewareCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
