import * as t from '@babel/types';
import {traverse} from '@babel/core';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {addImport} from '@/application/project/code/transformation/javascript/utils/addImport';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';

export type NuxtStoryblokPluginConfiguration = {
    plugin: {
        module: string,
        factory: string,
    },
    storyblokVueModule: string,
    nuxtAppModule: string,
};

/**
 * Scaffolds the Croct Storyblok plugin file for Nuxt.
 *
 * Generates the canonical plugin body that wires the Storyblok API into Croct
 * inside a defineNuxtPlugin callback. Leaves hand-edited files untouched: if a
 * plugin definition is already present, the codemod returns unmodified.
 */
export class NuxtStoryblokPluginCodemod implements Codemod<t.File, CodemodOptions> {
    private readonly configuration: NuxtStoryblokPluginConfiguration;

    public constructor(configuration: NuxtStoryblokPluginConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        if (NuxtStoryblokPluginCodemod.hasPluginDefinition(input)) {
            return Promise.resolve({modified: false, result: input});
        }

        const factoryImport = addImport(input, {
            type: 'value',
            moduleName: this.configuration.plugin.module,
            importName: this.configuration.plugin.factory,
        });

        const useStoryblokApiImport = addImport(input, {
            type: 'value',
            moduleName: this.configuration.storyblokVueModule,
            importName: 'useStoryblokApi',
        });

        const defineNuxtPluginImport = addImport(input, {
            type: 'value',
            moduleName: this.configuration.nuxtAppModule,
            importName: 'defineNuxtPlugin',
        });

        const pluginCallback = t.arrowFunctionExpression(
            [t.identifier('nuxtApp')],
            t.blockStatement([
                t.expressionStatement(
                    t.callExpression(
                        t.identifier(factoryImport.localName),
                        [
                            t.identifier('nuxtApp'),
                            t.callExpression(
                                t.identifier(useStoryblokApiImport.localName),
                                [],
                            ),
                        ],
                    ),
                ),
            ]),
        );

        const defaultExport = t.exportDefaultDeclaration(
            t.callExpression(
                t.identifier(defineNuxtPluginImport.localName),
                [pluginCallback],
            ),
        );

        input.program
            .body
            .push(defaultExport);

        return Promise.resolve({modified: true, result: input});
    }

    private static hasPluginDefinition(ast: t.File): boolean {
        const defineName = getImportLocalName(ast, {
            moduleName: /^(#app|nuxt(\/.+)?)$/,
            importName: 'defineNuxtPlugin',
        }) ?? 'defineNuxtPlugin';

        let found = false;

        traverse(ast, {
            CallExpression: path => {
                const {callee} = path.node;

                if (t.isIdentifier(callee) && callee.name === defineName) {
                    found = true;

                    path.stop();
                }
            },
        });

        return found;
    }
}
