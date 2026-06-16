import {resolve} from 'path';
import {SymfonyBundleCodemod} from '@/application/project/code/transformation/php/symfonyBundleCodemod';
import {loadFixtures} from '../fixtures';

describe('SymfonyBundleCodemod', () => {
    const codemod = new SymfonyBundleCodemod({bundle: 'Croct\\Plug\\Symfony\\CroctBundle'});

    const scenarios = loadFixtures(resolve(__dirname, '../fixtures/symfony-bundles'), {}, {});

    it.each(scenarios)('transforms $name', async ({name, fixture}) => {
        const {modified, result} = await codemod.apply(fixture);

        expect(result).toMatchSnapshot(name);

        // `modified` is true exactly when the bundle was registered.
        expect(modified).toBe(result !== fixture);

        // Registering is idempotent: the bundle class is present in the result, or
        // the array was missing and the file was left unchanged.
        const reapplied = await codemod.apply(result);

        expect(reapplied.modified).toBe(false);
        expect(reapplied.result).toBe(result);
    });
});
