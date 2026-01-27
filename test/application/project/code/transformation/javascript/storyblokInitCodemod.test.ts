import {
    StoryblokInitCodemod,
    StoryblokInitCodemodOptions,
} from '@/application/project/code/transformation/javascript/storyblokInitCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';

describe('StoryblokInitCodemod', () => {
    function createTransformer(): JavaScriptCodemod<StoryblokInitCodemodOptions> {
        return new JavaScriptCodemod({
            languages: ['typescript', 'jsx'],
            codemod: new StoryblokInitCodemod(),
        });
    }

    it('should wrap storyblokInit arguments when imported from @storyblok/js', async () => {
        const transformer = createTransformer();

        const input = [
            "import { storyblokInit } from '@storyblok/js';",
            '',
            'storyblokInit({ accessToken: "token" });',
        ].join('\n');

        const {result, modified} = await transformer.apply(input, {
            name: 'withCroct',
            module: '@croct/storyblok',
        });

        expect(modified).toBe(true);
        expect(result).toEqual([
            'import { withCroct } from "@croct/storyblok";',
            "import { storyblokInit } from '@storyblok/js';",
            'storyblokInit(withCroct({ accessToken: "token" }));',
        ].join('\n'));
    });

    it('should wrap storyblokInit arguments when imported from @storyblok/react', async () => {
        const transformer = createTransformer();

        const input = [
            "import { storyblokInit } from '@storyblok/react';",
            '',
            'storyblokInit({ accessToken: "token" });',
        ].join('\n');

        const {result, modified} = await transformer.apply(input, {
            name: 'withCroct',
            module: '@croct/storyblok',
        });

        expect(modified).toBe(true);
        expect(result).toEqual([
            'import { withCroct } from "@croct/storyblok";',
            "import { storyblokInit } from '@storyblok/react';",
            'storyblokInit(withCroct({ accessToken: "token" }));',
        ].join('\n'));
    });

    it('should wrap member expression calls', async () => {
        const transformer = createTransformer();

        const input = [
            "import * as sb from '@storyblok/js';",
            '',
            'sb.storyblokInit({ accessToken: "token" });',
        ].join('\n');

        const {result, modified} = await transformer.apply(input, {
            name: 'withCroct',
            module: '@croct/storyblok',
        });

        expect(modified).toBe(true);
        expect(result).toEqual([
            'import { withCroct } from "@croct/storyblok";',
            "import * as sb from '@storyblok/js';",
            'sb.storyblokInit(withCroct({ accessToken: "token" }));',
        ].join('\n'));
    });

    it('should use existing import alias for wrapper function', async () => {
        const transformer = createTransformer();

        const input = [
            "import { withCroct as croctWrapper } from '@croct/storyblok';",
            "import { storyblokInit } from '@storyblok/js';",
            '',
            'storyblokInit({ accessToken: "token" });',
        ].join('\n');

        const {result, modified} = await transformer.apply(input, {
            name: 'withCroct',
            module: '@croct/storyblok',
        });

        expect(modified).toBe(true);
        expect(result).toEqual([
            "import { withCroct as croctWrapper } from '@croct/storyblok';",
            "import { storyblokInit } from '@storyblok/js';",
            '',
            'storyblokInit(croctWrapper({ accessToken: "token" }));',
        ].join('\n'));
    });

    it('should not modify code when storyblokInit import is not found', async () => {
        const transformer = createTransformer();

        const input = [
            "import { someOtherFunction } from '@storyblok/js';",
            '',
            'someOtherFunction({ accessToken: "token" });',
        ].join('\n');

        const {result, modified} = await transformer.apply(input, {
            name: 'withCroct',
            module: '@croct/storyblok',
        });

        expect(modified).toBe(false);
        expect(result).toBe(input);
    });

    it('should not modify code when no storyblok import exists', async () => {
        const transformer = createTransformer();

        const input = [
            "import { something } from 'other-module';",
            '',
            'storyblokInit({ accessToken: "token" });',
        ].join('\n');

        const {result, modified} = await transformer.apply(input, {
            name: 'withCroct',
            module: '@croct/storyblok',
        });

        expect(modified).toBe(false);
        expect(result).toBe(input);
    });

    it('should return unmodified when options are not provided', async () => {
        const transformer = createTransformer();

        const input = [
            "import { storyblokInit } from '@storyblok/js';",
            '',
            'storyblokInit({ accessToken: "token" });',
        ].join('\n');

        const {result, modified} = await transformer.apply(input);

        expect(modified).toBe(false);
        expect(result).toBe(input);
    });

    it('should wrap multiple storyblokInit calls', async () => {
        const transformer = createTransformer();

        const input = [
            "import { storyblokInit } from '@storyblok/js';",
            '',
            'storyblokInit({ accessToken: "token1" });',
            'storyblokInit({ accessToken: "token2" });',
        ].join('\n');

        const {result, modified} = await transformer.apply(input, {
            name: 'withCroct',
            module: '@croct/storyblok',
        });

        expect(modified).toBe(true);
        expect(result).toEqual([
            'import { withCroct } from "@croct/storyblok";',
            "import { storyblokInit } from '@storyblok/js';",
            'storyblokInit(withCroct({ accessToken: "token1" }));',
            'storyblokInit(withCroct({ accessToken: "token2" }));',
        ].join('\n'));
    });

    it('should handle storyblokInit with multiple arguments', async () => {
        const transformer = createTransformer();

        const input = [
            "import { storyblokInit } from '@storyblok/js';",
            '',
            'storyblokInit(config, options);',
        ].join('\n');

        const {result, modified} = await transformer.apply(input, {
            name: 'withCroct',
            module: '@croct/storyblok',
        });

        expect(modified).toBe(true);
        expect(result).toEqual([
            'import { withCroct } from "@croct/storyblok";',
            "import { storyblokInit } from '@storyblok/js';",
            'storyblokInit(withCroct(config, options));',
        ].join('\n'));
    });

    it('should add empty statement before import when first statement is not an import', async () => {
        const transformer = createTransformer();

        const input = [
            'const x = 1;',
            "import { storyblokInit } from '@storyblok/js';",
            '',
            'storyblokInit({ accessToken: "token" });',
        ].join('\n');

        const {result, modified} = await transformer.apply(input, {
            name: 'withCroct',
            module: '@croct/storyblok',
        });

        expect(modified).toBe(true);
        expect(result).toContain('import { withCroct } from "@croct/storyblok";');
        expect(result).toContain('storyblokInit(withCroct({ accessToken: "token" }));');
    });
});
