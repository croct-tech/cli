import {resolve} from 'path';
import {YamlMappingCodemod} from '@/application/project/code/transformation/yml/yamlMappingCodemod';
import {loadFixtures} from '../fixtures';

describe('YamlMappingCodemod', () => {
    const codemod = new YamlMappingCodemod();

    const options = {
        key: 'croct',
        entries: {
            app_id: "'%env(CROCT_APP_ID)%'",
            api_key: "'%env(CROCT_API_KEY)%'",
        },
    };

    const scenarios = loadFixtures(resolve(__dirname, '../fixtures/yaml-mapping'), {}, {});

    it.each(scenarios)('transforms $name', async ({name, fixture}) => {
        const {modified, result} = await codemod.apply(fixture, options);

        expect(result).toMatchSnapshot(name);

        // `modified` is true exactly when the mapping was added.
        expect(modified).toBe(result !== fixture);

        // Adding is idempotent: the top-level key is present in the result, so a
        // second pass detects it and changes nothing.
        const reapplied = await codemod.apply(result, options);

        expect(reapplied.modified).toBe(false);
        expect(reapplied.result).toBe(result);
    });
});
