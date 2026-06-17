import * as t from '@babel/types';
import {traverse} from '@babel/core';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';
import {addImport} from '@/application/project/code/transformation/javascript/utils/addImport';

export type ViteConfigPluginConfiguration = {
    /**
     * The plugin import to add and register.
     */
    plugin: {
        moduleName: string,
        importName: string,
        localName?: string,
    },

    /**
     * Where to insert the plugin in the `plugins` array. Defaults to the end.
     */
    position?: 'start' | 'end',
};

/**
 * Registers a Vite plugin in the `plugins` array of the Vite configuration.
 *
 * Supports the `defineConfig` call form and bare object exports, including the
 * indirect variable forms of each, with type-assertion wrappers unwrapped. The
 * plugin import is added and a `<plugin>()` call is inserted into the array. If
 * the plugin is already registered, the codemod returns unmodified.
 */
export class ViteConfigPluginCodemod implements Codemod<t.File, CodemodOptions> {
    private readonly configuration: ViteConfigPluginConfiguration;

    public constructor(configuration: ViteConfigPluginConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        const config = ViteConfigPluginCodemod.findConfig(input);

        if (config === null) {
            return Promise.resolve({modified: false, result: input});
        }

        const plugins = ViteConfigPluginCodemod.resolvePluginsArray(config);

        if (plugins === null) {
            return Promise.resolve({modified: false, result: input});
        }

        const {plugin, position = 'end'} = this.configuration;
        const importedName = getImportLocalName(input, {
            moduleName: plugin.moduleName,
            importName: plugin.importName,
        });

        if (importedName !== null && ViteConfigPluginCodemod.hasPluginCall(plugins, importedName)) {
            return Promise.resolve({modified: false, result: input});
        }

        const {localName} = addImport(input, {
            type: 'value',
            moduleName: plugin.moduleName,
            importName: plugin.importName,
            localName: plugin.localName,
        });

        const call = t.callExpression(t.identifier(localName), []);

        if (position === 'start') {
            plugins.elements.unshift(call);
        } else {
            plugins.elements.push(call);
        }

        return Promise.resolve({modified: true, result: input});
    }

    private static hasPluginCall(array: t.ArrayExpression, localName: string): boolean {
        return array.elements.some(
            element => element !== null
                && t.isCallExpression(element)
                && t.isIdentifier(element.callee)
                && element.callee.name === localName,
        );
    }

    /**
     * Returns the `plugins` array of the config, creating an empty one if it is
     * missing. Returns null when a `plugins` property exists but is not an inline
     * array (e.g. a spread or a variable), which cannot be edited safely.
     */
    private static resolvePluginsArray(config: t.ObjectExpression): t.ArrayExpression | null {
        for (const property of config.properties) {
            if (!t.isObjectProperty(property) || property.computed) {
                continue;
            }

            const {key} = property;
            const isPlugins = (t.isIdentifier(key) && key.name === 'plugins')
                || (t.isStringLiteral(key) && key.value === 'plugins');

            if (isPlugins) {
                return t.isArrayExpression(property.value) ? property.value : null;
            }
        }

        const plugins = t.arrayExpression([]);

        config.properties.push(t.objectProperty(t.identifier('plugins'), plugins));

        return plugins;
    }

    private static findConfig(ast: t.File): t.ObjectExpression | null {
        const defineName = getImportLocalName(ast, {
            moduleName: 'vite',
            importName: 'defineConfig',
        }) ?? 'defineConfig';

        let config: t.ObjectExpression | null = null;

        traverse(ast, {
            ExportDefaultDeclaration: path => {
                const declaration = ViteConfigPluginCodemod.unwrapTypeWrapper(path.node.declaration);

                if (t.isObjectExpression(declaration)) {
                    config = declaration;

                    return path.stop();
                }

                if (t.isCallExpression(declaration)) {
                    config = ViteConfigPluginCodemod.unwrapDefineCall(declaration, defineName);

                    return path.stop();
                }

                if (t.isIdentifier(declaration)) {
                    config = ViteConfigPluginCodemod.resolveBinding(ast, declaration.name, defineName);

                    return path.stop();
                }

                return path.skip();
            },
        });

        return config;
    }

    private static unwrapDefineCall(call: t.CallExpression, defineName: string): t.ObjectExpression | null {
        if (!t.isIdentifier(call.callee) || call.callee.name !== defineName) {
            return null;
        }

        const argument = call.arguments[0];

        if (argument === undefined) {
            return null;
        }

        const unwrapped = ViteConfigPluginCodemod.unwrapTypeWrapper(argument);

        return t.isObjectExpression(unwrapped) ? unwrapped : null;
    }

    private static unwrapTypeWrapper(node: t.Node): t.Node {
        let current = node;

        while (
            t.isTSAsExpression(current)
            || t.isTSSatisfiesExpression(current)
            || t.isTSTypeAssertion(current)
            || t.isTSNonNullExpression(current)
        ) {
            current = current.expression;
        }

        return current;
    }

    private static resolveBinding(ast: t.File, name: string, defineName: string): t.ObjectExpression | null {
        let resolved: t.ObjectExpression | null = null;

        traverse(ast, {
            VariableDeclarator: path => {
                const {node} = path;

                if (!t.isIdentifier(node.id) || node.id.name !== name) {
                    return;
                }

                if (node.init === null || node.init === undefined) {
                    return;
                }

                const init = ViteConfigPluginCodemod.unwrapTypeWrapper(node.init);

                if (t.isObjectExpression(init)) {
                    resolved = init;

                    return path.stop();
                }

                if (t.isCallExpression(init)) {
                    resolved = ViteConfigPluginCodemod.unwrapDefineCall(init, defineName);

                    if (resolved !== null) {
                        return path.stop();
                    }
                }
            },
        });

        return resolved;
    }
}
