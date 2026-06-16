import {resolve} from 'path';
import {LaravelRouteCodemod} from '@/application/project/code/transformation/php/laravelRouteCodemod';
import {loadFixtures} from '../fixtures';

describe('LaravelRouteCodemod', () => {
    const codemod = new LaravelRouteCodemod();

    const options = {
        slot: 'home-banner',
        url: '/croct/home-banner',
        view: 'croct.home-banner',
    };

    const scenarios = loadFixtures(resolve(__dirname, '../fixtures/laravel-route'), {}, {});

    it.each(scenarios)('transforms $name', async ({name, fixture}) => {
        const {modified, result} = await codemod.apply(fixture, options);

        expect(result).toMatchSnapshot(name);

        // `modified` is true exactly when the route was appended.
        expect(modified).toBe(result !== fixture);

        // Registering is idempotent: the route is present in the result, so a second
        // pass detects it and changes nothing.
        const reapplied = await codemod.apply(result, options);

        expect(reapplied.modified).toBe(false);
        expect(reapplied.result).toBe(result);
    });

    it('is a no-op when no route options are given', async () => {
        const {modified, result} = await codemod.apply('<?php\n');

        expect(modified).toBe(false);
        expect(result).toBe('<?php\n');
    });

    it('never creates routes/web.php from empty content', async () => {
        const {modified, result} = await codemod.apply('', options);

        expect(modified).toBe(false);
        expect(result).toBe('');
    });
});
