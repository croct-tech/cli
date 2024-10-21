import {resolve} from 'path';
import {loadFixtures} from '../fixtures';
import {ParseCode} from '@/application/project/sdk/code/parseCode';
import {CreateMiddleware} from '@/application/project/sdk/code/nextjs/createMiddleware';

describe('CreateMiddleware', () => {
    const scenarios = loadFixtures(
        resolve(__dirname, '../fixtures/nextjs-middleware-creation'),
        {},
        {},
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture}) => {
        const transformer = new ParseCode({
            languages: ['typescript', 'jsx'],
            codemod: new CreateMiddleware(),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });
});
