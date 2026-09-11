import {resolve} from 'path';
import type {NuxtConfig} from '@/application/project/code/transformation/javascript/nuxtConfigParser';
import {NuxtConfigParser} from '@/application/project/code/transformation/javascript/nuxtConfigParser';
import {loadFixtures} from '../fixtures';

describe('NuxtConfigParser', () => {
    const layoutOptions: NuxtConfig = {
        srcDir: 'src',
        future: {
            compatibilityVersion: 4,
        },
    };

    // Fixtures without an expectation resolve no layout option
    const scenarios = loadFixtures<NuxtConfig>(
        resolve(__dirname, '../fixtures/nuxt-config'),
        {},
        {
            'aliasedDefineCall.ts': layoutOptions,
            'bareObjectExport.ts': layoutOptions,
            'compatibilityVersionOnly.ts': {
                future: {
                    compatibilityVersion: 4,
                },
            },
            'constantReferences.ts': layoutOptions,
            'defineCall.ts': layoutOptions,
            'duplicateProperties.ts': layoutOptions,
            'ignoredProperties.ts': layoutOptions,
            'indirectConfigVariable.ts': layoutOptions,
            'nonObjectFuture.ts': {
                srcDir: 'src',
            },
            'srcDirOnly.ts': {
                srcDir: 'src',
            },
            'stringKeys.ts': layoutOptions,
            'templateLiteral.ts': layoutOptions,
            'withTypeAssertion.ts': layoutOptions,
        },
    );

    it.each(scenarios)('should correctly parse $name', ({fixture, options: expected}) => {
        const parser = new NuxtConfigParser();

        expect(parser.parse(fixture)).toEqual(expected);
    });
});
