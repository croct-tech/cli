import * as t from '@babel/types';
import type {NodePath} from '@babel/core';
import {traverse} from '@babel/core';
import type {ResultCode, Codemod} from '@/application/project/code/transformation/codemod';
import {hasReexport} from '@/application/project/code/transformation/javascript/utils/hasReexport';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';
import {addReexport} from '@/application/project/code/transformation/javascript/utils/addReexport';
import {addImport} from '@/application/project/code/transformation/javascript/utils/addImport';

type ConfigVariable = {
    name: string,
    root: t.Node,
    object: t.ObjectExpression,
    matcher: boolean,
};

type VariableMatch = {
    name: string,
    root: t.Node,
    declaration: t.VariableDeclarator,
};

export type ProxyConfiguration = {
    matcherPattern: string,
    exportName: string,
    import: {
        module: string,
        proxyFactoryName: string,
        proxyName: string,
    },
};

/**
 * Refactors the proxy wrapping it with necessary configuration.
 *
 * This transformer wraps the existing proxy function with a higher-order
 * function that provides the necessary configuration for the proxy to
 * work correctly. It can also detect if the proxy is already configured
 * or missing configuration and apply the necessary changes.
 */
export class NextJsProxyCodemod implements Codemod<t.File> {
    private readonly configuration: ProxyConfiguration;

    public constructor(options: ProxyConfiguration) {
        this.configuration = options;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        const {body} = input.program;

        const isProxyReexported = hasReexport(input, {
            moduleName: this.configuration.import.module,
            importName: this.configuration.import.proxyName,
        });

        const localConfig = NextJsProxyCodemod.findConfig(input);

        const addConfigExport = (): void => {
            // Add a configuration object with the matcher pattern
            body.push(t.exportNamedDeclaration(
                t.variableDeclaration('const', [
                    t.variableDeclarator(
                        t.identifier('config'),
                        t.objectExpression([
                            t.objectProperty(
                                t.identifier('matcher'),
                                t.stringLiteral(this.configuration.matcherPattern),
                            ),
                        ]),
                    ),
                ]),
            ));
        };

        if (isProxyReexported) {
            if (localConfig !== null) {
                // Proxy is re-exported and config found in the source code,
                // consider the proxy configured
                return Promise.resolve({
                    modified: false,
                    result: input,
                });
            }

            // Add a configuration object with the matcher pattern
            addConfigExport();

            return Promise.resolve({
                modified: true,
                result: input,
            });
        }

        const proxyFactoryName = getImportLocalName(input, {
            moduleName: this.configuration.import.module,
            importName: this.configuration.import.proxyFactoryName,
        });

        const proxyName = getImportLocalName(input, {
            moduleName: this.configuration.import.module,
            importName: this.configuration.import.proxyName,
        });

        const existingImports: string[] = [];

        if (proxyFactoryName !== null) {
            existingImports.push(proxyFactoryName);
        }

        if (proxyName !== null) {
            existingImports.push(proxyName);
        }

        if (existingImports.length > 0 && NextJsProxyCodemod.isCalled(input, existingImports)) {
            // The proxy is already called in the source code, consider it refactored
            return Promise.resolve({
                modified: false,
                result: input,
            });
        }

        let proxyNode = NextJsProxyCodemod.refactorProxy(
            input,
            this.configuration.exportName,
            proxyFactoryName ?? this.configuration.import.proxyFactoryName,
            localConfig !== null && localConfig.matcher ? localConfig.name : undefined,
        );

        if (proxyNode === null) {
            if (localConfig === null) {
                // No proxy found or configuration object,
                // just add proxy re-export
                addReexport(input, {
                    type: 'value',
                    moduleName: this.configuration.import.module,
                    importName: this.configuration.import.proxyName,
                });

                addConfigExport();

                return Promise.resolve({
                    modified: true,
                    result: input,
                });
            }

            // Configurations found but no proxy, add the proxy
            proxyNode = t.exportDefaultDeclaration(
                t.callExpression(
                    t.identifier(proxyFactoryName ?? this.configuration.import.proxyFactoryName),
                    [
                        t.objectExpression([
                            t.objectProperty(
                                t.identifier('matcher'),
                                t.memberExpression(
                                    t.identifier(localConfig.name),
                                    t.identifier('matcher'),
                                ),
                            ),
                        ]),
                    ],
                ),
            );

            body.push(proxyNode);
        }

        if (localConfig !== null) {
            // Refactor the configuration object to include the matcher property
            this.configureMatcher(localConfig.object, this.configuration.matcherPattern);

            const configPosition = body.indexOf(localConfig.root as t.Statement);
            const proxyPosition = body.indexOf(proxyNode as t.Statement);

            if (configPosition > proxyPosition) {
                /*
                   The proxy references the config object, so the config should be moved before it.
                   Any variable or function used by the config object should be moved alongside it.

                   The current logic handles most cases, including edge cases with multiple references.
                   However, variable shadowing isn't accounted for, as it's highly complex to address
                   and unlikely to occur as Next.js requires the config to be static for analysis at build time.
                 */

                body.splice(proxyPosition, 0, ...body.splice(configPosition, 1));

                // Move any references of the config object alongside it
                for (const reference of NextJsProxyCodemod.findReferencesFrom(localConfig.root, input.program)) {
                    const referencePosition = body.indexOf(reference as t.Statement);

                    if (referencePosition > proxyPosition) {
                        body.splice(proxyPosition, 0, ...body.splice(referencePosition, 1));
                    }
                }
            }
        }

        if (proxyFactoryName === null) {
            // If no import for the proxy factory was found, add it
            addImport(input, {
                type: 'value',
                moduleName: this.configuration.import.module,
                importName: this.configuration.import.proxyFactoryName,
            });
        }

        return Promise.resolve({
            modified: true,
            result: input,
        });
    }

    /**
     * Adds the proxy matcher to the config object.
     *
     * @param configObject The object expression representing the configuration.
     * @param pattern The pattern to add to the matcher.
     * @return true if the config object was modified, false otherwise.
     */
    private configureMatcher(configObject: t.ObjectExpression, pattern: string): boolean {
        let modified = false;

        // Loop through the config properties to locate the 'matcher' property
        for (const property of configObject.properties) {
            if (
                t.isObjectProperty(property)
                && t.isIdentifier(property.key)
                && property.key.name === 'matcher'
            ) {
                if (t.isStringLiteral(property.value)) {
                    if (property.value.value === pattern) {
                        // The matcher already exists, no need to modify
                        break;
                    }

                    // Wrap single matcher string in an array and add 'matcher' identifier
                    property.value = t.arrayExpression([
                        property.value,
                        t.stringLiteral(pattern),
                    ]);

                    modified = true;

                    break;
                }

                if (t.isArrayExpression(property.value)) {
                    const {elements} = property.value;

                    if (!elements.some(element => t.isStringLiteral(element) && element.value === pattern)) {
                        elements.push(t.stringLiteral(pattern));

                        modified = true;
                    }

                    break;
                }

                if (t.isIdentifier(property.value)) {
                    // Convert matcher identifier into an array, if necessary, and append 'matcher'
                    property.value = t.arrayExpression([
                        t.spreadElement(
                            t.conditionalExpression(
                                t.callExpression(
                                    t.memberExpression(
                                        t.identifier('Array'),
                                        t.identifier('isArray'),
                                    ),
                                    [property.value],
                                ),
                                property.value,
                                t.arrayExpression([property.value]),
                            ),
                        ),
                        t.stringLiteral(pattern),
                    ]);

                    modified = true;
                }
            }
        }

        return modified;
    }

    /**
     * Refactors the proxy wrapping it with necessary configuration.
     *
     * @param ast The AST representing the source code.
     * @param exportName The name of the proxy identifier.
     * @param functionName The name of the proxy function.
     * @param configName Optional name of the configuration object variable.
     * @return The root node of the refactored proxy or null if not found.
     */
    private static refactorProxy(
        ast: t.File,
        exportName: string,
        functionName: string,
        configName?: string,
    ): t.Node | null {
        let rootNode: t.Node | null = null;

        traverse(ast, {
            ExportNamedDeclaration: path => {
                const {node} = path;
                const {declaration, specifiers = []} = node;

                // export function proxy() {}
                if (t.isFunctionDeclaration(declaration)) {
                    if (
                        t.isFunctionDeclaration(node.declaration)
                        && t.isIdentifier(node.declaration.id)
                        && node.declaration.id.name === exportName
                    ) {
                        path.replaceWith(
                            t.exportNamedDeclaration(
                                t.variableDeclaration('const', [
                                    t.variableDeclarator(
                                        t.identifier(exportName),
                                        NextJsProxyCodemod.wrapProxy(
                                            t.isFunctionDeclaration(node.declaration)
                                                ? NextJsProxyCodemod.createFunctionExpression(node.declaration)
                                                : node.declaration,
                                            functionName,
                                            configName,
                                        ),
                                    ),
                                ]),
                                [],
                            ),
                        );

                        rootNode = NextJsProxyCodemod.getRootNode(path);

                        return path.stop();
                    }

                    return path.skip();
                }

                // export const proxy = function() {}
                if (t.isVariableDeclaration(declaration)) {
                    for (const declarator of declaration.declarations) {
                        if (
                            t.isVariableDeclarator(declarator)
                            && t.isIdentifier(declarator.id)
                            && declarator.id.name === exportName
                        ) {
                            const initializer = declarator.init ?? null;

                            if (initializer !== null) {
                                declarator.init = NextJsProxyCodemod.wrapProxy(
                                    initializer,
                                    functionName,
                                    configName,
                                );
                                rootNode = NextJsProxyCodemod.getRootNode(path);

                                return path.stop();
                            }
                        }
                    }
                }

                // export {proxy}
                for (const specifier of specifiers) {
                    if (
                        t.isExportSpecifier(specifier)
                        && t.isIdentifier(specifier.exported)
                        && t.isIdentifier(specifier.local)
                        && ([exportName, 'default']).includes(specifier.exported.name)
                    ) {
                        rootNode = NextJsProxyCodemod.replaceProxyDeclaration(
                            ast,
                            specifier.local.name,
                            functionName,
                            configName,
                        );

                        return path.stop();
                    }
                }

                return path.skip();
            },
            ExportDefaultDeclaration: path => {
                const {node} = path;
                const {declaration} = node;

                // export default () => {}
                if (t.isArrowFunctionExpression(declaration)) {
                    path.replaceWith(
                        t.exportDefaultDeclaration(
                            NextJsProxyCodemod.wrapProxy(
                                declaration,
                                functionName,
                                configName,
                            ),
                        ),
                    );

                    rootNode = NextJsProxyCodemod.getRootNode(path);

                    return path.stop();
                }

                // export default function() {}
                if (t.isFunctionDeclaration(declaration)) {
                    path.replaceWith(
                        t.exportDefaultDeclaration(
                            NextJsProxyCodemod.wrapProxy(
                                NextJsProxyCodemod.createFunctionExpression(declaration, true),
                                functionName,
                                configName,
                            ),
                        ),
                    );

                    rootNode = NextJsProxyCodemod.getRootNode(path);

                    return path.stop();
                }

                // export default proxy
                if (t.isIdentifier(declaration)) {
                    rootNode = NextJsProxyCodemod.replaceProxyDeclaration(
                        ast,
                        declaration.name,
                        functionName,
                        configName,
                    );

                    return path.stop();
                }

                return path.skip();
            },
        });

        return rootNode;
    }

    private static replaceProxyDeclaration(
        file: t.File,
        name: string,
        functionName: string,
        configName?: string,
    ): t.Node | null {
        let rootNode: t.Node | null = null;

        traverse(file, {
            VariableDeclarator: path => {
                const {node} = path;

                if (t.isIdentifier(node.id) && node.id.name === name) {
                    const initializer = node.init ?? null;

                    if (initializer !== null) {
                        node.init = NextJsProxyCodemod.wrapProxy(initializer, functionName, configName);
                        rootNode = NextJsProxyCodemod.getRootNode(path);
                    }

                    return path.stop();
                }

                return path.skip();
            },
            FunctionDeclaration: path => {
                const {node} = path;

                if (t.isIdentifier(node.id) && node.id.name === name) {
                    path.replaceWith(
                        NextJsProxyCodemod.wrapFunctionDeclaration(
                            node,
                            functionName,
                            configName,
                            t.isIdentifier(node.id)
                                ? node.id.name
                                : undefined,
                        ),
                    );

                    rootNode = NextJsProxyCodemod.getRootNode(path);

                    return path.stop();
                }

                return path.skip();
            },
        });

        return rootNode;
    }

    /**
     * Checks if any of the given functions are called in the source code.
     *
     * @param file The AST representing the source code.
     * @param functionNames The names of the functions to search for.
     * @return true if the proxy is called, false otherwise.
     */
    private static isCalled(file: t.File, functionNames: string[]): boolean {
        let wrapped = false;

        traverse(file, {
            CallExpression: path => {
                const {node} = path;

                if (
                    t.isIdentifier(node.callee)
                    && functionNames.includes(node.callee.name)
                ) {
                    wrapped = true;

                    return path.stop();
                }

                return path.skip();
            },
        });

        return wrapped;
    }

    /**
     * Finds the proxy configuration object in the t.
     *
     * @param ast The AST representing the source code.
     * @return The information about the config object or null if not found.
     */
    private static findConfig(ast: t.File): ConfigVariable | null {
        let config: ConfigVariable | null = null;

        traverse(ast, {
            ExportNamedDeclaration: path => {
                const {declaration, specifiers = []} = path.node;

                // export const config = {}
                if (t.isVariableDeclaration(declaration)) {
                    for (const declarator of declaration.declarations) {
                        if (
                            t.isVariableDeclarator(declarator)
                            && t.isIdentifier(declarator.id)
                            && declarator.id.name === 'config'
                        ) {
                            const match = t.isIdentifier(declarator.init)
                                // export const config = variable
                                ? NextJsProxyCodemod.findVariableDeclarator(ast, declarator.init.name)
                                : {
                                    name: 'config',
                                    root: NextJsProxyCodemod.getRootNode(path),
                                    declaration: declarator,
                                };

                            if (match === null || match.declaration.init === null) {
                                return path.stop();
                            }

                            if (t.isObjectExpression(match.declaration.init)) {
                                config = {
                                    name: match.name,
                                    root: match.root,
                                    object: match.declaration.init,
                                    matcher: NextJsProxyCodemod.hasMatcherProperty(match.declaration.init),
                                };

                                return path.stop();
                            }
                        }
                    }
                }

                // export {config}
                for (const specifier of specifiers) {
                    if (
                        t.isExportSpecifier(specifier)
                        && t.isIdentifier(specifier.exported)
                        && t.isIdentifier(specifier.local)
                        && specifier.exported.name === 'config'
                    ) {
                        const match = NextJsProxyCodemod.findVariableDeclarator(ast, specifier.local.name);

                        if (match !== null && t.isObjectExpression(match.declaration.init)) {
                            config = {
                                name: match.name,
                                root: match.root,
                                object: match.declaration.init,
                                matcher: NextJsProxyCodemod.hasMatcherProperty(match.declaration.init),
                            };
                        }

                        return path.stop();
                    }
                }

                return path.skip();
            },
        });

        return config;
    }

    /**
     * Determines if the config object contains a 'matcher' property.
     *
     * @param configObject The object expression representing the configuration.
     * @return true if the config object contains a 'matcher' property, false otherwise.
     */
    private static hasMatcherProperty(configObject: t.ObjectExpression): boolean {
        for (const property of configObject.properties) {
            if (
                t.isObjectProperty(property)
                && t.isIdentifier(property.key)
                && property.key.name === 'matcher'
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Finds the variable declarator node with the given name.
     *
     * @param ast The AST representing the source code.
     * @param name The name of the variable to search for.
     * @return The information about the variable declarator or null if not found.
     */
    private static findVariableDeclarator(
        ast: t.File,
        name: string,
    ): VariableMatch | null {
        let declarator: VariableMatch | null = null;

        traverse(ast, {
            VariableDeclarator: path => {
                if (!t.isProgram(path.parentPath.parent)) {
                    return path.skip();
                }

                const {node} = path;

                if (
                    t.isVariableDeclarator(node)
                    && t.isIdentifier(node.id)
                    && node.id.name === name
                ) {
                    if (t.isIdentifier(node.init)) {
                        // If the initializer is an identifier, recursively search for the declaration
                        declarator = NextJsProxyCodemod.findVariableDeclarator(ast, node.init.name);
                    } else {
                        declarator = {
                            name: name,
                            root: NextJsProxyCodemod.getRootNode(path),
                            declaration: node,
                        };
                    }

                    return path.stop();
                }

                return path.skip();
            },
        });

        return declarator;
    }

    /**
     * Wraps the given node with the HOC proxy.
     *
     * @param node The node to wrap with the proxy.
     * @param functionName The name of the proxy function.
     * @param configName Optional name of the configuration object variable.
     * @return The transformed proxy node.
     */
    private static wrapProxy(node: t.Expression, functionName: string, configName?: string): t.CallExpression {
        return t.callExpression(
            t.identifier(functionName),
            [
                configName !== undefined
                    ? t.objectExpression([
                        t.objectProperty(
                            t.identifier('matcher'),
                            t.memberExpression(
                                t.identifier(configName),
                                t.identifier('matcher'),
                            ),
                        ),
                        t.objectProperty(
                            t.identifier('next'),
                            node,
                        ),
                    ])
                    : node,
            ],
        );
    }

    /**
     * Wraps a function declaration in a proxy expression as a variable declaration.
     *
     * @param functionDeclaration The function declaration to wrap.
     * @param functionName The name of the proxy function.
     * @param configName Optional name of the configuration object variable.
     * @param name The name of the constant variable to assign the proxy to.
     * @return A variable declaration that assigns the wrapped proxy to a constant.
     */
    private static wrapFunctionDeclaration(
        functionDeclaration: t.FunctionDeclaration,
        functionName: string,
        configName?: string,
        name = 'proxy',
    ): t.VariableDeclaration {
        return t.variableDeclaration(
            'const',
            [
                t.variableDeclarator(
                    t.identifier(name),
                    NextJsProxyCodemod.wrapProxy(
                        NextJsProxyCodemod.createFunctionExpression(functionDeclaration),
                        functionName,
                        configName,
                    ),
                ),
            ],
        );
    }

    /**
     * Find all references from the origin node.
     *
     * @param origin The node to find references from.
     * @param root The root node to search for references.
     *
     * @return The list of nodes that reference the origin node without duplicates.
     */
    private static findReferencesFrom(origin: t.Node, root: t.Program): t.Node[] {
        const names = new Set<string>();

        // Visit the origin node to find identifier references
        traverse(root, {
            enter: path => {
                const {node} = path;

                if (node !== origin) {
                    return;
                }

                path.traverse({
                    Identifier: function acceptNested(nestedPath) {
                        const identifier = nestedPath.node;

                        if (NextJsProxyCodemod.isVariableReference(nestedPath.parent, identifier)) {
                            names.add(identifier.name);
                        }

                        return nestedPath.skip();
                    },
                });

                return path.stop();
            },
        });

        const references: t.Node[] = [];

        // Visit the root node to collect variable, function, and class declarations that match the found names
        traverse(root, {
            VariableDeclarator: path => {
                if (!t.isProgram(path.parentPath.parent)) {
                    return path.skip();
                }

                const {node} = path;

                if (t.isIdentifier(node.id) && names.has(node.id.name)) {
                    references.push(NextJsProxyCodemod.getRootNode(path));
                }

                return path.skip();
            },
            FunctionDeclaration: path => {
                if (!t.isProgram(path.parent)) {
                    return;
                }

                const {node} = path;

                if (t.isIdentifier(node.id) && names.has(node.id.name)) {
                    references.push(NextJsProxyCodemod.getRootNode(path));
                }

                return path.skip();
            },
            ClassDeclaration: path => {
                if (!t.isProgram(path.parent)) {
                    return;
                }

                const {node} = path;

                if (t.isIdentifier(node.id) && names.has(node.id.name)) {
                    references.push(NextJsProxyCodemod.getRootNode(path));
                }

                return path.skip();
            },
        });

        return [
            ...new Set(references.flatMap(
                // Recursively find references from the found references
                reference => [reference, ...NextJsProxyCodemod.findReferencesFrom(reference, root)],
            )),
        ];
    }

    /**
     * Determine if an identifier is a reference to a variable.
     *
     * Identifiers can appear in various contexts, such as variable declarations,
     * object properties, or function calls. This method checks if the given identifier
     * is used as a reference to a variable.
     *
     * @param parent The parent node containing the identifier.
     * @param node The identifier node to evaluate.
     *
     * @return true if the identifier is a variable reference, false otherwise.
     */
    private static isVariableReference(parent: t.Node, node: t.Identifier): boolean {
        if (t.isVariableDeclarator(parent)) {
            return parent.init === node;
        }

        if (
            t.isClassProperty(parent)
            || t.isObjectProperty(parent)
            || t.isProperty(parent)
        ) {
            return parent.value === node;
        }

        if (t.isMemberExpression(parent)) {
            return parent.object === node;
        }

        if (t.isCallExpression(parent) || t.isNewExpression(parent)) {
            return parent.callee === node;
        }

        return t.isExpression(parent);
    }

    /**
     * Creates an anonymous function expression from a function declaration.
     *
     * @param functionDeclaration The function declaration to convert.
     * @param named Whether the function should preserve its name.
     * @return A function expression.
     */
    private static createFunctionExpression(
        functionDeclaration: t.FunctionDeclaration,
        named = false,
    ): t.FunctionExpression {
        return t.functionExpression(
            named ? functionDeclaration.id : null,
            functionDeclaration.params,
            functionDeclaration.body,
            functionDeclaration.generator,
            functionDeclaration.async,
        );
    }

    /**
     * Find the root node of the given path.
     *
     * The root node is the top-level node of the AST tree below the program node.
     *
     * @param path The path to find the root node from.
     * @return The root node of the path.
     */
    private static getRootNode(path: NodePath): t.Node {
        let current: NodePath = path;

        while (current.parentPath !== null && !t.isProgram(current.parent)) {
            current = current.parentPath;
        }

        return current.node;
    }
}
