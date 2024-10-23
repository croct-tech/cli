import * as t from '@babel/types';
import traverse, {NodePath} from '@babel/traverse';
import {ResultCode, Codemod} from '@/application/project/sdk/code/codemod';
import {ExportMatcher, hasReexport} from '@/application/project/sdk/code/javascript/hasReexport';
import {getImportLocalName} from '@/application/project/sdk/code/javascript/getImportLocalName';
import {addReexport} from '@/application/project/sdk/code/javascript/addReexport';
import {addImport} from '@/application/project/sdk/code/javascript/addImport';

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

export type MiddlewareOptions = {
    import: {
        module: string,
        highOrderFunctionName: string,
        middlewareFunctionName: string,
        configName: string,
        matcherName: string,
        matcherLocalName: string,
    },
};

/**
 * Refactors the middleware wrapping it with necessary configuration.
 *
 * This transformer wraps the existing middleware function with a higher-order
 * function that provides the necessary configuration for the middleware to
 * work correctly. It can also detect if the middleware is already configured
 * or missing configuration and apply the necessary changes.
 */
export class ConfigureMiddleware implements Codemod<t.File> {
    private readonly options: MiddlewareOptions;

    public constructor(options: MiddlewareOptions) {
        this.options = options;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        const {body} = input.program;

        const middlewareReexportMatcher = {
            moduleName: this.options.import.module,
            importName: this.options.import.middlewareFunctionName,
        } satisfies ExportMatcher;

        const configReexportMatcher: ExportMatcher = {
            moduleName: this.options.import.module,
            importName: this.options.import.configName,
        };

        const reexportedConfig = hasReexport(input, configReexportMatcher);

        const localConfig = reexportedConfig
            ? null
            : ConfigureMiddleware.findConfig(input);

        if (hasReexport(input, middlewareReexportMatcher)) {
            if (localConfig !== null || reexportedConfig) {
                // Middleware is already re-exported, consider it refactored
                return Promise.resolve({
                    modified: false,
                    result: input,
                });
            }

            const modified = addReexport(input, {
                type: 'value',
                moduleName: this.options.import.module,
                importName: this.options.import.configName,
            });

            return Promise.resolve({
                modified: modified,
                result: input,
            });
        }

        const hofLocalName = getImportLocalName(input, {
            moduleName: this.options.import.module,
            importName: this.options.import.highOrderFunctionName,
        });

        const middlewareLocalName = getImportLocalName(input, middlewareReexportMatcher);

        const middlewareImports: string[] = [];

        if (hofLocalName !== null) {
            middlewareImports.push(hofLocalName);
        }

        if (middlewareLocalName !== null) {
            middlewareImports.push(middlewareLocalName);
        }

        if (middlewareImports.length > 0 && ConfigureMiddleware.isCalled(input, middlewareImports)) {
            // The middleware is already called in the source code, consider it refactored
            return Promise.resolve({
                modified: false,
                result: input,
            });
        }

        const matcherLocalName = localConfig !== null
            ? getImportLocalName(input, {
                moduleName: this.options.import.module,
                importName: this.options.import.matcherName,
            })
            : null;

        let middlewareNode = ConfigureMiddleware.refactorMiddleware(
            input,
            hofLocalName ?? this.options.import.highOrderFunctionName,
            localConfig !== null && localConfig.matcher ? localConfig.name : undefined,
        );

        if (middlewareNode === null) {
            if (localConfig === null) {
                const middlewareReexport = addReexport(input, {
                    type: 'value',
                    moduleName: this.options.import.module,
                    importName: this.options.import.middlewareFunctionName,
                });

                const configReexport = addReexport(input, {
                    type: 'value',
                    moduleName: this.options.import.module,
                    importName: this.options.import.configName,
                });

                return Promise.resolve({
                    modified: middlewareReexport || configReexport,
                    result: input,
                });
            }

            middlewareNode = t.exportDefaultDeclaration(
                t.callExpression(
                    t.identifier(hofLocalName ?? this.options.import.highOrderFunctionName),
                    [
                        t.objectExpression([
                            t.objectProperty(
                                t.identifier('matcher'),
                                t.memberExpression(
                                    t.identifier(localConfig.name),
                                    t.identifier(matcherLocalName ?? this.options.import.matcherName),
                                ),
                            ),
                        ]),
                    ],
                ),
            );

            body.push(middlewareNode);
        }

        if (localConfig !== null) {
            this.configureMatcher(localConfig.object, matcherLocalName ?? this.options.import.matcherLocalName);

            const configPosition = body.indexOf(localConfig.root as t.Statement);
            const middlewarePosition = body.indexOf(middlewareNode as t.Statement);

            if (configPosition > middlewarePosition) {
                /*
                   The middleware references the config object, so the config should be moved before it.
                   Any variable or function used by the config object should be moved alongside it.

                   The current logic handles most cases, including edge cases with multiple references.
                   However, variable shadowing isn't accounted for, as it's highly complex to address
                   and unlikely to occur as Next.js requires the config to be static for analysis at build time.
                 */

                body.splice(middlewarePosition, 0, ...body.splice(configPosition, 1));

                // Move any references of the config object alongside it
                for (const reference of ConfigureMiddleware.findReferencesFrom(localConfig.root, input.program)) {
                    const referencePosition = body.indexOf(reference as t.Statement);

                    if (referencePosition > middlewarePosition) {
                        body.splice(middlewarePosition, 0, ...body.splice(referencePosition, 1));
                    }
                }
            }
        }

        if (hofLocalName === null) {
            addImport(input, {
                type: 'value',
                moduleName: this.options.import.module,
                importName: this.options.import.highOrderFunctionName,
            });
        }

        if (localConfig?.matcher === true && matcherLocalName === null) {
            addImport(input, {
                type: 'value',
                moduleName: this.options.import.module,
                importName: this.options.import.matcherName,
                localName: this.options.import.matcherLocalName,
            });
        }

        return Promise.resolve({
            modified: true,
            result: input,
        });
    }

    /**
     * Adds the middleware matcher to the config object.
     *
     * @param configObject The object expression representing the configuration.
     * @param matcherName The name of the matcher identifier.
     * @return true if the config object was modified, false otherwise.
     */
    private configureMatcher(configObject: t.ObjectExpression, matcherName: string): boolean {
        let modified = false;

        // Loop through the config properties to locate the 'matcher' property
        for (const property of configObject.properties) {
            if (
                t.isObjectProperty(property)
                && t.isIdentifier(property.key)
                && property.key.name === 'matcher'
            ) {
                if (t.isStringLiteral(property.value)) {
                    // Wrap single matcher string in an array and add 'matcher' identifier
                    property.value = t.arrayExpression([
                        property.value,
                        t.identifier(matcherName),
                    ]);

                    modified = true;

                    break;
                }

                if (t.isArrayExpression(property.value)) {
                    const {elements} = property.value;

                    if (!elements.some(element => t.isIdentifier(element) && element.name === matcherName)) {
                        elements.push(t.identifier(matcherName));

                        modified = true;
                    }

                    break;
                }

                if (t.isIdentifier(property.value)) {
                    if (property.value.name === matcherName) {
                        break;
                    }

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
                        t.identifier(matcherName),
                    ]);

                    modified = true;
                }
            }
        }

        return modified;
    }

    /**
     * Refactors the middleware wrapping it with necessary configuration.
     *
     * @param ast The AST representing the source code.
     * @param functionName The name of the middleware function.
     * @param configName Optional name of the configuration object variable.
     * @return The root node of the refactored middleware or null if not found.
     */
    private static refactorMiddleware(ast: t.File, functionName: string, configName?: string): t.Node | null {
        let rootNode: t.Node | null = null;

        traverse(ast, {
            ExportNamedDeclaration: function accept(path) {
                const {node} = path;
                const {declaration, specifiers = []} = node;

                // export function middleware() {}
                if (t.isFunctionDeclaration(declaration)) {
                    if (
                        t.isFunctionDeclaration(node.declaration)
                        && t.isIdentifier(node.declaration.id)
                        && node.declaration.id.name === 'middleware'
                    ) {
                        path.replaceWith(
                            t.exportNamedDeclaration(
                                t.variableDeclaration('const', [
                                    t.variableDeclarator(
                                        t.identifier('middleware'),
                                        ConfigureMiddleware.wrapMiddleware(
                                            t.isFunctionDeclaration(node.declaration)
                                                ? ConfigureMiddleware.createFunctionExpression(node.declaration)
                                                : node.declaration,
                                            functionName,
                                            configName,
                                        ),
                                    ),
                                ]),
                                [],
                            ),
                        );

                        rootNode = ConfigureMiddleware.getRootNode(path);

                        return path.stop();
                    }

                    return path.skip();
                }

                // export const middleware = function() {}
                if (t.isVariableDeclaration(declaration)) {
                    for (const declarator of declaration.declarations) {
                        if (
                            t.isVariableDeclarator(declarator)
                            && t.isIdentifier(declarator.id)
                            && declarator.id.name === 'middleware'
                        ) {
                            const initializer = declarator.init ?? null;

                            if (initializer !== null) {
                                declarator.init = ConfigureMiddleware.wrapMiddleware(
                                    initializer,
                                    functionName,
                                    configName,
                                );
                                rootNode = ConfigureMiddleware.getRootNode(path);

                                return path.stop();
                            }
                        }
                    }
                }

                // export {middleware}
                for (const specifier of specifiers) {
                    if (
                        t.isExportSpecifier(specifier)
                        && t.isIdentifier(specifier.exported)
                        && t.isIdentifier(specifier.local)
                        && (['middleware', 'default']).includes(specifier.exported.name)
                    ) {
                        rootNode = ConfigureMiddleware.replaceMiddlewareDeclaration(
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
            ExportDefaultDeclaration: function accept(path) {
                const {node} = path;
                const {declaration} = node;

                // export default () => {}
                if (t.isArrowFunctionExpression(declaration)) {
                    path.replaceWith(
                        t.exportDefaultDeclaration(
                            ConfigureMiddleware.wrapMiddleware(
                                declaration,
                                functionName,
                                configName,
                            ),
                        ),
                    );

                    rootNode = ConfigureMiddleware.getRootNode(path);

                    return path.stop();
                }

                // export default function() {}
                if (t.isFunctionDeclaration(declaration)) {
                    path.replaceWith(
                        t.exportDefaultDeclaration(
                            ConfigureMiddleware.wrapMiddleware(
                                ConfigureMiddleware.createFunctionExpression(declaration, true),
                                functionName,
                                configName,
                            ),
                        ),
                    );

                    rootNode = ConfigureMiddleware.getRootNode(path);

                    return path.stop();
                }

                // export default middleware
                if (t.isIdentifier(declaration)) {
                    rootNode = ConfigureMiddleware.replaceMiddlewareDeclaration(
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

    private static replaceMiddlewareDeclaration(
        file: t.File,
        name: string,
        functionName: string,
        configName?: string,
    ): t.Node | null {
        let rootNode: t.Node | null = null;

        traverse(file, {
            VariableDeclarator: function accept(path): any {
                const {node} = path;

                if (t.isIdentifier(node.id) && node.id.name === name) {
                    const initializer = node.init ?? null;

                    if (initializer !== null) {
                        node.init = ConfigureMiddleware.wrapMiddleware(initializer, functionName, configName);
                        rootNode = ConfigureMiddleware.getRootNode(path);
                    }

                    return path.stop();
                }

                return path.skip();
            },
            FunctionDeclaration: function accept(path) {
                const {node} = path;

                if (t.isIdentifier(node.id) && node.id.name === name) {
                    path.replaceWith(
                        ConfigureMiddleware.wrapFunctionDeclaration(
                            node,
                            functionName,
                            configName,
                            t.isIdentifier(node.id)
                                ? node.id.name
                                : undefined,
                        ),
                    );

                    rootNode = ConfigureMiddleware.getRootNode(path);

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
     * @return true if the middleware is called, false otherwise.
     */
    private static isCalled(file: t.File, functionNames: string[]): boolean {
        let wrapped = false;

        traverse(file, {
            CallExpression: function accept(path): any {
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
     * Finds the middleware configuration object in the t.
     *
     * @param ast The AST representing the source code.
     * @return The information about the config object or null if not found.
     */
    private static findConfig(ast: t.File): ConfigVariable | null {
        let config: ConfigVariable | null = null;

        traverse(ast, {
            ExportNamedDeclaration: function accept(path): any {
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
                                ? ConfigureMiddleware.findVariableDeclarator(ast, declarator.init.name)
                                : {
                                    name: 'config',
                                    root: ConfigureMiddleware.getRootNode(path),
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
                                    matcher: ConfigureMiddleware.hasMatcherProperty(match.declaration.init),
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
                        const match = ConfigureMiddleware.findVariableDeclarator(ast, specifier.local.name);

                        if (match !== null && t.isObjectExpression(match.declaration.init)) {
                            config = {
                                name: match.name,
                                root: match.root,
                                object: match.declaration.init,
                                matcher: ConfigureMiddleware.hasMatcherProperty(match.declaration.init),
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
            VariableDeclarator: function accept(path): any {
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
                        declarator = ConfigureMiddleware.findVariableDeclarator(ast, node.init.name);
                    } else {
                        declarator = {
                            name: name,
                            root: ConfigureMiddleware.getRootNode(path),
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
     * Wraps the given node with the HOC middleware.
     *
     * @param node The node to wrap with the middleware.
     * @param functionName The name of the middleware function.
     * @param configName Optional name of the configuration object variable.
     * @return The transformed middleware node.
     */
    private static wrapMiddleware(node: t.Expression, functionName: string, configName?: string): t.CallExpression {
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
     * Wraps a function declaration in a middleware expression as a variable declaration.
     *
     * @param functionDeclaration The function declaration to wrap.
     * @param functionName The name of the middleware function.
     * @param configName Optional name of the configuration object variable.
     * @param name The name of the constant variable to assign the middleware to.
     * @return A variable declaration that assigns the wrapped middleware to a constant.
     */
    private static wrapFunctionDeclaration(
        functionDeclaration: t.FunctionDeclaration,
        functionName: string,
        configName?: string,
        name = 'middleware',
    ): t.VariableDeclaration {
        return t.variableDeclaration(
            'const',
            [
                t.variableDeclarator(
                    t.identifier(name),
                    ConfigureMiddleware.wrapMiddleware(
                        ConfigureMiddleware.createFunctionExpression(functionDeclaration),
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
            enter: function accept(path): any {
                const {node} = path;

                if (node !== origin) {
                    return;
                }

                path.traverse({
                    Identifier: function acceptNested(nestedPath): any {
                        const identifier = nestedPath.node;

                        if (ConfigureMiddleware.isVariableReference(nestedPath.parent, identifier)) {
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
            VariableDeclarator: function accept(path): any {
                if (!t.isProgram(path.parentPath.parent)) {
                    return path.skip();
                }

                const {node} = path;

                if (t.isIdentifier(node.id) && names.has(node.id.name)) {
                    references.push(ConfigureMiddleware.getRootNode(path));
                }

                return path.skip();
            },
            FunctionDeclaration: function accept(path): any {
                if (!t.isProgram(path.parent)) {
                    return;
                }

                const {node} = path;

                if (t.isIdentifier(node.id) && names.has(node.id.name)) {
                    references.push(ConfigureMiddleware.getRootNode(path));
                }

                return path.skip();
            },
            ClassDeclaration: function accept(path): any {
                if (!t.isProgram(path.parent)) {
                    return;
                }

                const {node} = path;

                if (t.isIdentifier(node.id) && names.has(node.id.name)) {
                    references.push(ConfigureMiddleware.getRootNode(path));
                }

                return path.skip();
            },
        });

        return [
            ...new Set(references.flatMap(
                // Recursively find references from the found references
                reference => [reference, ...ConfigureMiddleware.findReferencesFrom(reference, root)],
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
