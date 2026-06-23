import * as t from '@babel/types';
import {traverse} from '@babel/core';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {CodemodError} from '@/application/project/code/transformation/codemod';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';
import {spreadAsArray} from '@/application/project/code/transformation/javascript/utils/spreadAsArray';

export type NuxtConfigModuleConfiguration = {
    moduleName: string,
    required?: boolean,
};

/**
 * Appends a module to the modules array of the Nuxt configuration.
 *
 * Supports both the defineNuxtConfig call form and bare object exports,
 * including the indirect variable forms of each. Type-assertion wrappers
 * are transparently unwrapped. If the module is already configured, the
 * codemod returns unmodified.
 */
export class NuxtConfigModuleCodemod implements Codemod<t.File, CodemodOptions> {
    private readonly configuration: NuxtConfigModuleConfiguration;

    public constructor(configuration: NuxtConfigModuleConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        const config = NuxtConfigModuleCodemod.findConfig(input);

        if (config === null) {
            if (this.configuration.required === true) {
                throw new CodemodError('No Nuxt configuration found to register the Croct module.');
            }

            return Promise.resolve({modified: false, result: input});
        }

        const modulesProperty = NuxtConfigModuleCodemod.findModulesProperty(config);

        if (modulesProperty === null) {
            config.properties.push(
                t.objectProperty(
                    t.identifier('modules'),
                    t.arrayExpression([t.stringLiteral(this.configuration.moduleName)]),
                ),
            );

            return Promise.resolve({modified: true, result: input});
        }

        if (!t.isArrayExpression(modulesProperty.value)) {
            // Normalize a non-array `modules` value (a variable, a call, etc.) into an array with
            // the module, preserving the existing value. The cast is forced by `ObjectProperty.value`'s
            // `Expression | PatternLike` type; an object-literal value is always an expression.
            modulesProperty.value = t.arrayExpression([
                spreadAsArray(modulesProperty.value as t.Expression),
                t.stringLiteral(this.configuration.moduleName),
            ]);

            return Promise.resolve({modified: true, result: input});
        }

        if (this.hasModule(modulesProperty.value)) {
            return Promise.resolve({modified: false, result: input});
        }

        modulesProperty.value
            .elements
            .push(t.stringLiteral(this.configuration.moduleName));

        return Promise.resolve({modified: true, result: input});
    }

    private hasModule(array: t.ArrayExpression): boolean {
        for (const element of array.elements) {
            if (element === null) {
                continue;
            }

            if (t.isStringLiteral(element) && element.value === this.configuration.moduleName) {
                return true;
            }

            if (t.isArrayExpression(element)) {
                const [first] = element.elements;

                if (first !== null && t.isStringLiteral(first) && first.value === this.configuration.moduleName) {
                    return true;
                }
            }
        }

        return false;
    }

    private static findConfig(ast: t.File): t.ObjectExpression | null {
        const defineName = NuxtConfigModuleCodemod.resolveDefineName(ast);

        let configObject: t.ObjectExpression | null = null;

        traverse(ast, {
            ExportDefaultDeclaration: path => {
                const declaration = NuxtConfigModuleCodemod.unwrapTypeWrapper(path.node.declaration);

                if (t.isObjectExpression(declaration)) {
                    configObject = declaration;

                    return path.stop();
                }

                if (t.isCallExpression(declaration)) {
                    const inner = NuxtConfigModuleCodemod.unwrapDefineCall(declaration, defineName);

                    if (inner !== null) {
                        configObject = inner;

                        return path.stop();
                    }

                    return path.skip();
                }

                if (t.isIdentifier(declaration)) {
                    const resolved = NuxtConfigModuleCodemod.resolveBinding(ast, declaration.name, defineName);

                    if (resolved !== null) {
                        configObject = resolved;
                    }

                    return path.stop();
                }

                return path.skip();
            },
        });

        return configObject;
    }

    private static resolveDefineName(ast: t.File): string {
        return getImportLocalName(ast, {
            moduleName: /^nuxt(\/.+)?$/,
            importName: 'defineNuxtConfig',
        }) ?? 'defineNuxtConfig';
    }

    private static findModulesProperty(config: t.ObjectExpression): t.ObjectProperty | null {
        for (const property of config.properties) {
            if (!t.isObjectProperty(property) || property.computed) {
                continue;
            }

            const {key} = property;

            if (t.isIdentifier(key) && key.name === 'modules') {
                return property;
            }

            if (t.isStringLiteral(key) && key.value === 'modules') {
                return property;
            }
        }

        return null;
    }

    private static unwrapDefineCall(call: t.CallExpression, defineName: string): t.ObjectExpression | null {
        if (!t.isIdentifier(call.callee) || call.callee.name !== defineName) {
            return null;
        }

        const firstArg = call.arguments[0];

        if (firstArg === undefined) {
            return null;
        }

        const unwrapped = NuxtConfigModuleCodemod.unwrapTypeWrapper(firstArg);

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

                if (node.init === undefined || node.init === null) {
                    return;
                }

                const init = NuxtConfigModuleCodemod.unwrapTypeWrapper(node.init);

                if (t.isObjectExpression(init)) {
                    resolved = init;

                    return path.stop();
                }

                if (t.isCallExpression(init)) {
                    const inner = NuxtConfigModuleCodemod.unwrapDefineCall(init, defineName);

                    if (inner !== null) {
                        resolved = inner;

                        return path.stop();
                    }
                }
            },
        });

        return resolved;
    }
}
