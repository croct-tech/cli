import * as t from '@babel/types';
import {traverse} from '@babel/core';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {addImport} from '@/application/project/code/transformation/javascript/utils/addImport';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';
import {VuePluginCodemod} from '@/application/project/code/transformation/javascript/vuePluginCodemod';

export type VueStoryblokConfiguration = {
    plugin: {
        module: string,
        factory: string,
    },
    storyblok: {
        module: string,
        identifier: string,
    },
};

/**
 * Migrates an existing Storyblok Vue plugin registration to Croct.
 *
 * Rewrites the use call so the original options are passed through the Croct
 * Storyblok factory, drops the Storyblok identifier from its import, and adds
 * the new factory import. If the migration is already in place, the codemod
 * returns unmodified.
 */
export class VueStoryblokCodemod implements Codemod<t.File, CodemodOptions> {
    private readonly configuration: VueStoryblokConfiguration;

    public constructor(configuration: VueStoryblokConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        const anchor = VuePluginCodemod.findMountAnchor(input);

        if (anchor === null) {
            return Promise.resolve({modified: false, result: input});
        }

        const {plugin, storyblok} = this.configuration;

        const factoryLocal = getImportLocalName(input, {
            moduleName: plugin.module,
            importName: plugin.factory,
        });

        if (factoryLocal !== null && VuePluginCodemod.hasFactoryCall(anchor, factoryLocal)) {
            return Promise.resolve({modified: false, result: input});
        }

        const storyblokLocal = getImportLocalName(input, {
            moduleName: storyblok.module,
            importName: storyblok.identifier,
        });

        if (storyblokLocal === null) {
            return Promise.resolve({modified: false, result: input});
        }

        const useCall = VuePluginCodemod.findUseCall(anchor, storyblokLocal);

        if (useCall === null) {
            return Promise.resolve({modified: false, result: input});
        }

        const factoryImport = addImport(input, {
            type: 'value',
            moduleName: plugin.module,
            importName: plugin.factory,
        });

        const options = useCall.arguments.slice(1);

        useCall.arguments = [
            t.callExpression(
                t.identifier(factoryImport.localName),
                options.filter((node): node is t.Expression => !t.isJSXNamespacedName(node)),
            ),
        ];

        VueStoryblokCodemod.dropImportSpecifier(input, storyblok.module, storyblok.identifier);

        return Promise.resolve({modified: true, result: input});
    }

    private static dropImportSpecifier(ast: t.File, moduleName: string, importName: string): void {
        traverse(ast, {
            ImportDeclaration: path => {
                const {node} = path;

                if (node.source.value !== moduleName) {
                    return path.skip();
                }

                const remaining = node.specifiers.filter(specifier => {
                    if (!t.isImportSpecifier(specifier)) {
                        return true;
                    }

                    const {imported} = specifier;
                    const importedName = t.isIdentifier(imported) ? imported.name : imported.value;

                    return importedName !== importName;
                });

                if (remaining.length === 0) {
                    path.remove();

                    return;
                }

                if (remaining.length !== node.specifiers.length) {
                    node.specifiers = remaining;
                }

                return path.skip();
            },
        });
    }
}
