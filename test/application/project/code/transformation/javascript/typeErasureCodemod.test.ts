import {resolve} from 'path';
import {loadFixtures} from '../fixtures';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {TypeErasureCodemod} from '@/application/project/code/transformation/javascript/typeErasureCodemod';

describe('TypeErasureCodemod', () => {
    const scenarios = loadFixtures(resolve(__dirname, '../fixtures/ts-type-erasure'), {}, {});

    it.each(scenarios)('should correctly transform $name', async ({name, fixture}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new TypeErasureCodemod(),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
