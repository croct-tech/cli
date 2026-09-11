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
    pluginName: string,
    storyblokVueModule: string,
    nuxtAppModule: string,
};

/**
 * Scaffolds the Croct Storyblok plugin file for Nuxt.
 *
 * Generates the canonical plugin that wires the Storyblok API into Croct.
 * The plugin runs after the regular ones because the Storyblok API may be
 * installed by an application plugin (e.g., `storyblok.ts`) rather than by
 * the Storyblok module, and Nuxt runs application plugins in filename order.
 * Leaves hand-edited files untouched: if the file already has a default
 * export or a plugin definition, the codemod returns unmodified.
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

        const setupMethod = t.objectMethod(
            'method',
            t.identifier('setup'),
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

        const pluginDefinition = t.objectExpression([
            t.objectProperty(t.identifier('name'), t.stringLiteral(this.configuration.pluginName)),
            t.objectProperty(t.identifier('enforce'), t.stringLiteral('post')),
            setupMethod,
        ]);

        const defaultExport = t.exportDefaultDeclaration(
            t.callExpression(
                t.identifier(defineNuxtPluginImport.localName),
                [pluginDefinition],
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
            // A default export is the file's plugin, whatever its form
            ExportDefaultDeclaration: path => {
                found = true;

                path.stop();
            },
            ExportSpecifier: path => {
                const {exported} = path.node;

                if ((t.isIdentifier(exported) ? exported.name : exported.value) === 'default') {
                    found = true;

                    path.stop();
                }
            },
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
