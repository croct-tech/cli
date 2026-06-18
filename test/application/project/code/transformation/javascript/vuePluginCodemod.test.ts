import {resolve} from 'path';
import {readFileSync} from 'fs';
import type * as t from '@babel/types';
import type {VuePluginConfiguration} from '@/application/project/code/transformation/javascript/vuePluginCodemod';
import {VuePluginCodemod} from '@/application/project/code/transformation/javascript/vuePluginCodemod';
import {JavaScriptCodemod} from '@/application/project/code/transformation/javascript/javaScriptCodemod';
import {parse} from '@/application/project/code/transformation/javascript/utils/parse';
import {loadFixtures} from '../fixtures';

describe('VuePluginCodemod', () => {
    const fixturesPath = resolve(__dirname, '../fixtures/vue-plugin');

    const defaultOptions: VuePluginConfiguration = {
        plugin: {
            module: '@croct/plug-vue',
            factory: 'createCroct',
        },
        args: {
            appId: {type: 'literal', value: 'YOUR_APP_ID'},
        },
    };

    function loadFixture(name: string): t.File {
        return parse(readFileSync(resolve(fixturesPath, name), 'utf-8'), ['typescript']);
    }

    it.each(
        loadFixtures<VuePluginConfiguration>(
            fixturesPath,
            defaultOptions,
            {
                'argsReference.ts': {
                    ...defaultOptions,
                    args: {
                        appId: {
                            type: 'reference',
                            path: ['import', 'meta', 'env', 'VITE_CROCT_APP_ID'],
                        },
                    },
                },
                'noArgs.ts': {
                    plugin: defaultOptions.plugin,
                    args: undefined,
                },
                'argsTernary.ts': {
                    ...defaultOptions,
                    args: {
                        appId: {
                            type: 'ternary',
                            condition: {
                                left: {
                                    type: 'reference',
                                    path: ['import', 'meta', 'env', 'MODE'],
                                },
                                operator: '===',
                                right: {type: 'literal', value: 'production'},
                            },
                            consequent: {
                                type: 'reference',
                                path: ['import', 'meta', 'env', 'VITE_CROCT_APP_ID_PROD'],
                            },
                            alternate: {
                                type: 'reference',
                                path: ['import', 'meta', 'env', 'VITE_CROCT_APP_ID_DEV'],
                            },
                        },
                    },
                },
            },
        ),
    )('apply should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new VuePluginCodemod(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });

    it.each<{name: string, fixture: string, expected: object | null}>([
        {
            name: 'a chained mount call',
            fixture: 'chainedMount.ts',
            expected: expect.objectContaining({kind: 'chain'}),
        },
        {
            name: 'a chained mount call with intermediate plugins',
            fixture: 'chainedWithPlugins.ts',
            expected: expect.objectContaining({kind: 'chain'}),
        },
        {
            name: 'a variable-form mount call',
            fixture: 'variableForm.ts',
            expected: expect.objectContaining({kind: 'variable', binding: 'app'}),
        },
        {
            name: 'a file without createApp import',
            fixture: 'noCreateAppCall.ts',
            expected: null,
        },
        {
            name: 'a file where createApp is imported but never called',
            fixture: 'createAppImportedButNotCalled.ts',
            expected: null,
        },
        {
            name: 'a file with createApp call but no .mount',
            fixture: 'noMountCall.ts',
            expected: null,
        },
        {
            name: 'multiple createApp calls (only the first is anchored)',
            fixture: 'multipleCreateAppCallsChainedFirst.ts',
            expected: expect.objectContaining({kind: 'chain'}),
        },
    ])('findMountAnchor should resolve $name', ({fixture, expected}) => {
        const ast = loadFixture(fixture);

        expect(VuePluginCodemod.findMountAnchor(ast)).toEqual(expected);
    });

    it.each<{name: string, fixture: string, factoryLocal: string, expected: boolean}>([
        {
            name: 'a variable-form anchor with the factory already registered',
            fixture: 'alreadyRegistered.ts',
            factoryLocal: 'createCroct',
            expected: true,
        },
        {
            name: 'a chained anchor with the factory already registered',
            fixture: 'chainedAlreadyRegistered.ts',
            factoryLocal: 'createCroct',
            expected: true,
        },
        {
            name: 'a variable-form anchor where the factory is imported but never used',
            fixture: 'importedButNotUsed.ts',
            factoryLocal: 'createCroct',
            expected: false,
        },
        {
            name: 'a variable-form anchor where the factory is aliased and used',
            fixture: 'aliasedFactoryImportAndUsed.ts',
            factoryLocal: 'plug',
            expected: true,
        },
        {
            name: 'a chained anchor without any use call',
            fixture: 'chainedMount.ts',
            factoryLocal: 'createCroct',
            expected: false,
        },
        {
            name: 'a chained anchor walking past unrelated use calls',
            fixture: 'chainedWithPlugins.ts',
            factoryLocal: 'createCroct',
            expected: false,
        },
        {
            name: 'a variable-form anchor without the factory',
            fixture: 'variableForm.ts',
            factoryLocal: 'createCroct',
            expected: false,
        },
        {
            name: 'a variable-form anchor walking past unrelated use calls',
            fixture: 'intermediateNonUseStatement.ts',
            factoryLocal: 'createCroct',
            expected: false,
        },
    ])('hasFactoryCall should report $name', ({fixture, factoryLocal, expected}) => {
        const ast = loadFixture(fixture);
        const anchor = VuePluginCodemod.findMountAnchor(ast);
        const result = anchor !== null && VuePluginCodemod.hasFactoryCall(anchor, factoryLocal);

        expect(result).toBe(expected);
    });

    it.each<{name: string, fixture: string, identifier: string, expected: object | null}>([
        {
            name: 'a variable-form .use(StoryblokVue, ...) call',
            fixture: '../vue-storyblok/storyblokBasicMigration.ts',
            identifier: 'StoryblokVue',
            expected: expect.objectContaining({type: 'CallExpression'}),
        },
        {
            name: 'a chained .use(StoryblokVue, ...) call',
            fixture: '../vue-storyblok/storyblokChainedAppUse.ts',
            identifier: 'StoryblokVue',
            expected: expect.objectContaining({type: 'CallExpression'}),
        },
        {
            name: 'a missing identifier in variable form',
            fixture: 'variableWithPlugins.ts',
            identifier: 'NotPresent',
            expected: null,
        },
        {
            name: 'a missing identifier in chain form',
            fixture: 'chainedWithPlugins.ts',
            identifier: 'NotPresent',
            expected: null,
        },
    ])('findUseCall should locate $name', ({fixture, identifier, expected}) => {
        const ast = loadFixture(fixture);
        const anchor = VuePluginCodemod.findMountAnchor(ast);
        const useCall = anchor === null ? null : VuePluginCodemod.findUseCall(anchor, identifier);

        expect(useCall).toEqual(expected);
    });

    it('throws when required and there is no Vue app initialization', async () => {
        const transformer = new JavaScriptCodemod({
            languages: ['typescript'],
            codemod: new VuePluginCodemod({...defaultOptions, required: true}),
        });

        await expect(transformer.apply("import { something } from 'somewhere';\n\nsomething({ foo: 'bar' });\n"))
            .rejects
            .toThrow('No Vue app initialization found to register the Croct plugin.');
    });
});
