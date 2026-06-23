import {resolve} from 'path';
import {DrupalLocalSettingsCodemod} from '@/application/project/code/transformation/php/drupalLocalSettingsCodemod';
import {loadFixtures} from '../fixtures';

describe('DrupalLocalSettingsCodemod', () => {
    const codemod = new DrupalLocalSettingsCodemod({file: 'settings.local.php'});

    const scenarios = loadFixtures(resolve(__dirname, '../fixtures/drupal-local-settings'), {}, {});

    it.each(scenarios)('transforms $name', async ({name, fixture}) => {
        const {modified, result} = await codemod.apply(fixture);

        expect(result).toMatchSnapshot(name);

        // `modified` is true exactly when the content changed.
        expect(modified).toBe(result !== fixture);

        // Enabling is idempotent: the include is active in the result, so a second
        // pass detects it and changes nothing.
        const reapplied = await codemod.apply(result);

        expect(reapplied.modified).toBe(false);
        expect(reapplied.result).toBe(result);
    });

    it('never creates settings.php from empty content', async () => {
        const {modified, result} = await codemod.apply('');

        expect(modified).toBe(false);
        expect(result).toBe('');
    });

    it('throws when required and the content is empty', async () => {
        const requiredCodemod = new DrupalLocalSettingsCodemod({
            file: 'settings.local.php',
            required: true,
        });

        await expect(async () => requiredCodemod.apply('   \n\t')).rejects
            .toThrow('settings.php is empty; cannot add the settings.local.php include.');
    });
});
