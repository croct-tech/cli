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

    it('inserts the writer before the return when the handler is wrapped in try/catch', async () => {
        const {fixture} = scenarios.find(scenario => scenario.name === 'tryCatchWrapped.ts')!;

        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new HydrogenCookiesCodemod(defaultOptions),
        });

        const {result} = await transformer.apply(fixture);

        const writerIndex = result.indexOf('writeCroctCookies(response, appLoadContext)');
        const returnIndex = result.indexOf('return response;');

        // The writer must run on the response before it is returned, not as unreachable
        // code after the try/catch block.
        expect(writerIndex).toBeGreaterThanOrEqual(0);
        expect(returnIndex).toBeGreaterThanOrEqual(0);
        expect(writerIndex).toBeLessThan(returnIndex);
    });

    it('does not add a second writer when one is already called elsewhere in the handler', async () => {
        const {fixture} = scenarios.find(scenario => scenario.name === 'alreadyPresentOutsideBlock.ts')!;

        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new HydrogenCookiesCodemod(defaultOptions),
        });

        const {result} = await transformer.apply(fixture);

        // The writer is already called in the handler (outside the `try` block that holds the
        // Set-Cookie), so the codemod must be a no-op — idempotence is scoped to the whole handler,
        // not just the insertion block.
        expect((result.match(/writeCroctCookies\(/g) ?? []).length).toBe(1);
    });
});
