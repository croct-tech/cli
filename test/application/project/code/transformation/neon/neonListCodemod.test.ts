import {resolve} from 'path';
import {NeonListCodemod} from '@/application/project/code/transformation/neon/neonListCodemod';
import {loadFixtures} from '../fixtures';

describe('NeonListCodemod', () => {
    const codemod = new NeonListCodemod();

    const options = {key: 'includes', value: 'vendor/croct/plug-php/extension.neon'};

    const scenarios = loadFixtures(resolve(__dirname, '../fixtures/neon-list'), {}, {});

    it.each(scenarios)('transforms $name', async ({name, fixture}) => {
        const {modified, result} = await codemod.apply(fixture, options);

        expect(result).toMatchSnapshot(name);

        // `modified` is true exactly when the value was added.
        expect(modified).toBe(result !== fixture);

        // Adding is idempotent: the value is listed in the result, so a second pass
        // detects it and changes nothing.
        const reapplied = await codemod.apply(result, options);

        expect(reapplied.modified).toBe(false);
        expect(reapplied.result).toBe(result);
    });

    it('rejects an inline list', () => {
        expect(() => codemod.apply('includes: [foo.neon]\nparameters:\n\tlevel: 8\n', options)).toThrow();
    });

    it('tolerates an unterminated quote', async () => {
        // The unterminated string consumes the rest of the line rather than crashing.
        const {modified} = await codemod.apply("parameters:\n\tname: 'oops\n", options);

        expect(modified).toBe(true);
    });
});
