/* eslint-disable no-param-reassign -- False positives */
import {visit} from 'recast';
import {namedTypes as Ast, builders as builder} from 'ast-types';
import {NodePath} from 'ast-types/node-path';
import {ResultCode, Codemod} from '@/application/project/sdk/code/codemod';

type ExpressionKind = Parameters<typeof builder.callExpression>[0];
type ExportDeclaration = Ast.ExportNamedDeclaration | Ast.ExportDefaultDeclaration;

type ConfigVariable = {
    name: string,
    root: Ast.Node,
    object: Ast.ObjectExpression,
    matcher: boolean,
};

type VariableMatch = {
    name: string,
    root: Ast.Node,
    declaration: Ast.VariableDeclarator,
};

type StatementKind = Ast.Program['body'][number];

export type MiddlewareOptions = {
    import: {
        module: string,
        functionName: string,
        matcherName: string,
        matcherLocalName: string,
    },
};

/**
 * Refactors the middleware wrapping it with necessary configuration.
 *
 * This transformer wraps the middleware function with a higher-order function that
 * provides the necessary configuration for the middleware to work correctly.
 *
 * It refactors the middleware configuration to include a matcher for
 * the routes that the middleware should apply to.
 */
export class RefactorMiddleware implements Codemod<Ast.File> {
    private readonly options: MiddlewareOptions;

    public constructor(options: MiddlewareOptions) {
        this.options = options;
    }

    public apply(input: Ast.File): Promise<ResultCode<Ast.File>> {
        const config = RefactorMiddleware.findConfig(input.program);
        const middlewareNode = RefactorMiddleware.refactorMiddleware(
            input,
            config !== null && config.matcher ? config.name : undefined,
        );

        if (middlewareNode === null) {
            return Promise.resolve({
                modified: false,
                result: input,
            });
        }

        const {program} = input;

        if (config !== null) {
            this.configureMatcher(config.object);

            const configPosition = program.body.indexOf(config.root as StatementKind);
            const middlewarePosition = program.body.indexOf(middlewareNode as StatementKind);

            if (configPosition > middlewarePosition) {
                /*
                   The middleware references the config object, so the config should be moved before it.
                   Any variable or function used by the config object should be moved alongside it.

                   The current logic handles most cases, including edge cases with multiple references.
                   However, variable shadowing isn't accounted for, as it's highly complex to address
                   and unlikely to occur as Next.js requires the config to be static for analysis at build time.
                 */

                program.body.splice(middlewarePosition, 0, ...program.body.splice(configPosition, 1));

                // Move any references of the config object alongside it
                for (const reference of RefactorMiddleware.findReferencesFrom(config.root, program)) {
                    const referencePosition = program.body.indexOf(reference as StatementKind);

                    if (referencePosition > middlewarePosition) {
                        program.body.splice(middlewarePosition, 0, ...program.body.splice(referencePosition, 1));
                    }
                }
            }
        }

        // Add import statement at the beginning of the file
        program.body.unshift(
            builder.importDeclaration(
                [
                    builder.importSpecifier(builder.identifier(this.options.import.functionName)),
                    ...(config?.matcher === true
                        ? [
                            builder.importSpecifier(
                                builder.identifier(this.options.import.matcherName),
                                this.options.import.matcherLocalName === this.options.import.matcherName
                                    ? null
                                    : builder.identifier(this.options.import.matcherLocalName),
                            ),
                        ]
                        : []),
                ],
                builder.literal(this.options.import.module),
            ),
        );

        return Promise.resolve({
            modified: true,
            result: input,
        });
    }

    /**
     * Adds the middleware matcher to the config object.
     *
     * @param configObject The object expression representing the configuration.
     * @return true if the config object was modified, false otherwise.
     */
    private configureMatcher(configObject: Ast.ObjectExpression): boolean {
        let modified = false;

        // Loop through the config properties to locate the 'matcher' property
        for (const property of configObject.properties) {
            if (
                Ast.ObjectProperty.check(property)
                && Ast.Identifier.check(property.key)
                && property.key.name === 'matcher'
            ) {
                if (Ast.StringLiteral.check(property.value)) {
                    // Wrap single matcher string in an array and add 'matcher' identifier
                    property.value = builder.arrayExpression([
                        property.value,
                        builder.identifier(this.options.import.matcherLocalName),
                    ]);

                    modified = true;

                    break;
                }

                if (Ast.ArrayExpression.check(property.value)) {
                    // Append 'matcher' identifier to the existing array
                    property.value
                        .elements
                        .push(builder.identifier(this.options.import.matcherLocalName));

                    modified = true;

                    break;
                }

                if (Ast.Identifier.check(property.value)) {
                    // Convert matcher identifier into an array, if necessary, and append 'matcher'
                    property.value = builder.arrayExpression([
                        builder.spreadElement(
                            builder.conditionalExpression(
                                builder.callExpression(
                                    builder.memberExpression(
                                        builder.identifier('Array'),
                                        builder.identifier('isArray'),
                                    ),
                                    [property.value],
                                ),
                                property.value,
                                builder.arrayExpression([property.value]),
                            ),
                        ),
                        builder.identifier(this.options.import.matcherLocalName),
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
     * @param configName Optional name of the configuration object variable.
     * @return The root node of the refactored middleware or null if not found.
     */
    private static refactorMiddleware(ast: Ast.File, configName?: string): Ast.Node | null {
        let rootNode: Ast.Node | null = null;

        visit(ast, {
            visitExportNamedDeclaration: function accept(path) {
                const {node} = path;
                const {declaration, specifiers = []} = node;

                // export function middleware() {}
                if (Ast.FunctionDeclaration.check(declaration)) {
                    if (
                        Ast.FunctionDeclaration.check(node.declaration)
                        && Ast.Identifier.check(node.declaration.id)
                        && node.declaration.id.name === 'middleware'
                    ) {
                        path.replace(
                            RefactorMiddleware.wrapExportFunctionDeclaration(
                                node,
                                node.declaration,
                                configName,
                            ),
                        );

                        rootNode = RefactorMiddleware.getRootNode(path);

                        return this.abort();
                    }

                    return false;
                }

                // export const middleware = function() {}
                if (Ast.VariableDeclaration.check(declaration)) {
                    for (const declarator of declaration.declarations) {
                        if (
                            Ast.VariableDeclarator.check(declarator)
                            && Ast.Identifier.check(declarator.id)
                            && declarator.id.name === 'middleware'
                        ) {
                            const initializer = declarator.init ?? null;

                            if (initializer !== null) {
                                declarator.init = RefactorMiddleware.wrapMiddleware(initializer, configName);
                                rootNode = RefactorMiddleware.getRootNode(path);

                                return this.abort();
                            }
                        }
                    }
                }

                // export {middleware}
                for (const specifier of specifiers) {
                    if (
                        Ast.ExportSpecifier.check(specifier)
                        && Ast.Identifier.check(specifier.exported)
                        && Ast.Identifier.check(specifier.local)
                        && (['middleware', 'default']).includes(specifier.exported.name)
                    ) {
                        rootNode = RefactorMiddleware.replaceMiddlewareDeclaration(
                            ast,
                            specifier.local.name,
                            configName,
                        );

                        return this.abort();
                    }
                }

                return false;
            },
            visitExportDefaultDeclaration: function accept(path) {
                const {node} = path;
                const {declaration} = node;

                // export default () => {}
                if (Ast.ArrowFunctionExpression.check(declaration)) {
                    path.replace(
                        builder.exportDefaultDeclaration(
                            RefactorMiddleware.wrapMiddleware(declaration, configName),
                        ),
                    );

                    rootNode = RefactorMiddleware.getRootNode(path);

                    return this.abort();
                }

                // export default function() {}
                if (Ast.FunctionDeclaration.check(declaration)) {
                    path.replace(
                        builder.exportDefaultDeclaration(
                            RefactorMiddleware.wrapMiddleware(
                                RefactorMiddleware.createFunctionExpression(declaration, true),
                                configName,
                            ),
                        ),
                    );

                    rootNode = RefactorMiddleware.getRootNode(path);

                    return this.abort();
                }

                // export default middleware
                if (Ast.Identifier.check(declaration)) {
                    rootNode = RefactorMiddleware.replaceMiddlewareDeclaration(ast, declaration.name, configName);

                    return this.abort();
                }

                return false;
            },
        });

        return rootNode;
    }

    private static replaceMiddlewareDeclaration(file: Ast.File, name: string, configName?: string): Ast.Node | null {
        let rootNode: Ast.Node | null = null;

        visit(file, {
            visitVariableDeclarator: function accept(path): any {
                const {node} = path;

                if (Ast.Identifier.check(node.id) && node.id.name === name) {
                    const initializer = node.init ?? null;

                    if (initializer !== null) {
                        node.init = RefactorMiddleware.wrapMiddleware(initializer, configName);
                        rootNode = RefactorMiddleware.getRootNode(path);
                    }

                    return this.abort();
                }

                return false;
            },
            visitFunctionDeclaration: function accept(path) {
                const {node} = path;

                if (Ast.Identifier.check(node.id) && node.id.name === name) {
                    path.replace(
                        RefactorMiddleware.wrapFunctionDeclaration(
                            node,
                            configName,
                            Ast.Identifier.check(node.id)
                                ? node.id.name
                                : undefined,
                        ),
                    );

                    rootNode = RefactorMiddleware.getRootNode(path);

                    return this.abort();
                }

                return false;
            },
        });

        return rootNode;
    }

    /**
     * Finds the middleware configuration object in the AST.
     *
     * @param ast The AST representing the source code.
     * @return The information about the config object or null if not found.
     */
    private static findConfig(ast: Ast.Program): ConfigVariable | null {
        let config: ConfigVariable | null = null;

        visit(ast, {
            visitExportNamedDeclaration: function accept(path): any {
                const {declaration, specifiers = []} = path.node;

                // export const config = {}
                if (Ast.VariableDeclaration.check(declaration)) {
                    for (const declarator of declaration.declarations) {
                        if (
                            Ast.VariableDeclarator.check(declarator)
                            && Ast.Identifier.check(declarator.id)
                            && declarator.id.name === 'config'
                        ) {
                            const match = Ast.Identifier.check(declarator.init)
                                // export const config = variable
                                ? RefactorMiddleware.findVariableDeclarator(ast, declarator.init.name)
                                : {
                                    name: 'config',
                                    root: RefactorMiddleware.getRootNode(path),
                                    declaration: declarator,
                                };

                            if (match === null || match.declaration.init === null) {
                                return this.abort();
                            }

                            if (Ast.ObjectExpression.check(match.declaration.init)) {
                                config = {
                                    name: match.name,
                                    root: match.root,
                                    object: match.declaration.init,
                                    matcher: RefactorMiddleware.hasMatcherProperty(match.declaration.init),
                                };

                                return this.abort();
                            }
                        }
                    }
                }

                // export {config}
                for (const specifier of specifiers) {
                    if (
                        Ast.ExportSpecifier.check(specifier)
                        && Ast.Identifier.check(specifier.exported)
                        && Ast.Identifier.check(specifier.local)
                        && specifier.exported.name === 'config'
                    ) {
                        const match = RefactorMiddleware.findVariableDeclarator(ast, specifier.local.name);

                        if (match !== null && Ast.ObjectExpression.check(match.declaration.init)) {
                            config = {
                                name: match.name,
                                root: match.root,
                                object: match.declaration.init,
                                matcher: RefactorMiddleware.hasMatcherProperty(match.declaration.init),
                            };
                        }

                        return this.abort();
                    }
                }

                return false;
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
    private static hasMatcherProperty(configObject: Ast.ObjectExpression): boolean {
        for (const property of configObject.properties) {
            if (
                Ast.ObjectProperty.check(property)
                && Ast.Identifier.check(property.key)
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
     * @param program The AST representing the source code.
     * @param name The name of the variable to search for.
     * @return The information about the variable declarator or null if not found.
     */
    private static findVariableDeclarator(
        program: Ast.Program,
        name: string,
    ): VariableMatch | null {
        let declarator: VariableMatch | null = null;

        visit(program, {
            visitVariableDeclarator: function accept(path): any {
                if (!Ast.Program.check(path.parent.parent.node)) {
                    return false;
                }

                const {node} = path;

                if (
                    Ast.VariableDeclarator.check(node)
                    && Ast.Identifier.check(node.id)
                    && node.id.name === name
                ) {
                    if (Ast.Identifier.check(node.init)) {
                        // If the initializer is an identifier, recursively search for the declaration
                        declarator = RefactorMiddleware.findVariableDeclarator(program, node.init.name);
                    } else {
                        declarator = {
                            name: name,
                            root: RefactorMiddleware.getRootNode(path),
                            declaration: node,
                        };
                    }

                    return this.abort();
                }

                return false;
            },
        });

        return declarator;
    }

    /**
     * Wraps the given node with the HOC middleware.
     *
     * @param node The node to wrap with the middleware.
     * @param configName Optional name of the configuration object variable.
     * @return The transformed middleware node.
     */
    private static wrapMiddleware(node: ExpressionKind, configName?: string): Ast.CallExpression {
        return builder.callExpression.from({
            callee: builder.identifier('withCroct'),
            arguments: [
                configName !== undefined
                    ? builder.objectExpression([
                        builder.property(
                            'init',
                            builder.identifier('matcher'),
                            builder.memberExpression(
                                builder.identifier(configName),
                                builder.identifier('matcher'),
                            ),
                        ),
                        builder.property(
                            'init',
                            builder.identifier('next'),
                            node,
                        ),
                    ])
                    : node,
            ],
        });
    }

    /**
     * Wraps a function declaration in a middleware expression as a variable declaration.
     *
     * @param functionDeclaration The function declaration to wrap.
     * @param configName Optional name of the configuration object variable.
     * @param name The name of the constant variable to assign the middleware to.
     * @return A variable declaration that assigns the wrapped middleware to a constant.
     */
    private static wrapFunctionDeclaration(
        functionDeclaration: Ast.FunctionDeclaration,
        configName?: string,
        name = 'middleware',
    ): Ast.VariableDeclaration {
        return builder.variableDeclaration(
            'const',
            [
                builder.variableDeclarator(
                    builder.identifier(name),
                    RefactorMiddleware.wrapMiddleware(
                        RefactorMiddleware.createFunctionExpression(functionDeclaration),
                        configName,
                    ),
                ),
            ],
        );
    }

    /**
     * Wraps an export function declaration with middleware logic.
     *
     * @param exportDeclaration The export declaration to wrap.
     * @param functionDeclaration The function declaration to wrap in middleware.
     * @param configName Optional name of the configuration object variable.
     * @return The updated export declaration with wrapped middleware.
     */
    private static wrapExportFunctionDeclaration(
        exportDeclaration: ExportDeclaration,
        functionDeclaration: Ast.FunctionDeclaration,
        configName?: string,
    ): ExportDeclaration {
        return RefactorMiddleware.restoreComments(
            exportDeclaration,
            builder.exportNamedDeclaration(
                builder.variableDeclaration('const', [
                    builder.variableDeclarator(
                        builder.identifier('middleware'),
                        RefactorMiddleware.wrapMiddleware(
                            Ast.FunctionDeclaration.check(functionDeclaration)
                                ? RefactorMiddleware.createFunctionExpression(functionDeclaration)
                                : functionDeclaration,
                            configName,
                        ),
                    ),
                ]),
                [],
            ),
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
    private static findReferencesFrom(origin: Ast.Node, root: Ast.Program): Ast.Node[] {
        const names = new Set<string>();

        // Visit the origin node to find identifier references
        visit(origin, {
            visitIdentifier: function accept(path): any {
                const {node} = path;
                const parent = path.parent.node;

                if (RefactorMiddleware.isVariableReference(parent, node)) {
                    names.add(node.name);
                }

                return false;
            },
        });

        const references: Ast.Node[] = [];

        // Visit the root node to collect variable, function, and class declarations that match the found names
        visit(root, {
            visitVariableDeclarator: function accept(path): any {
                if (!Ast.Program.check(path.parent.parent.node)) {
                    return false;
                }

                const {node} = path;

                if (Ast.Identifier.check(node.id) && names.has(node.id.name)) {
                    references.push(RefactorMiddleware.getRootNode(path));
                }

                return false;
            },
            visitFunctionDeclaration: function accept(path): any {
                if (!Ast.Program.check(path.parent.node)) {
                    return this.traverse(path);
                }

                const {node} = path;

                if (Ast.Identifier.check(node.id) && names.has(node.id.name)) {
                    references.push(RefactorMiddleware.getRootNode(path));
                }

                return false;
            },
            visitClassDeclaration: function accept(path): any {
                if (!Ast.Program.check(path.parent.node)) {
                    return this.traverse(path);
                }

                const {node} = path;

                if (Ast.Identifier.check(node.id) && names.has(node.id.name)) {
                    references.push(RefactorMiddleware.getRootNode(path));
                }

                return false;
            },
        });

        return [
            ...new Set(references.flatMap(
                // Recursively find references from the found references
                reference => [reference, ...RefactorMiddleware.findReferencesFrom(reference, root)],
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
    private static isVariableReference(parent: Ast.Node, node: Ast.Identifier): boolean {
        if (Ast.VariableDeclarator.check(parent)) {
            return parent.init === node;
        }

        if (
            Ast.ClassProperty.check(parent)
            || Ast.ObjectProperty.check(parent)
            || Ast.Property.check(parent)
        ) {
            return parent.value === node;
        }

        if (Ast.MemberExpression.check(parent)) {
            return parent.object === node;
        }

        if (Ast.CallExpression.check(parent) || Ast.NewExpression.check(parent)) {
            return parent.callee === node;
        }

        return Ast.Expression.check(parent);
    }

    /**
     * Creates an anonymous function expression from a function declaration.
     *
     * @param functionDeclaration The function declaration to convert.
     * @param named Whether the function should preserve its name.
     * @return A function expression.
     */
    private static createFunctionExpression(
        functionDeclaration: Ast.FunctionDeclaration,
        named = false,
    ): Ast.FunctionExpression {
        return builder.functionExpression.from({
            id: named ? functionDeclaration.id : null,
            params: functionDeclaration.params,
            body: functionDeclaration.body,
            generator: functionDeclaration.generator,
            async: functionDeclaration.async,
        });
    }

    /**
     * Find the root node of the given path.
     *
     * The root node is the top-level node of the AST tree below the program node.
     *
     * @param path The path to find the root node from.
     * @return The root node of the path.
     */
    private static getRootNode(path: NodePath): Ast.Node {
        let current = path;

        while (current.parent !== null && !Ast.Program.check(current.parent.node)) {
            current = current.parent;
        }

        return current.node;
    }

    /**
     * Restores comments from the source node to the target node.
     *
     * @param source The source node containing comments.
     * @param target The target node to which comments should be copied.
     * @return The target node with restored comments.
     */
    private static restoreComments<T extends Ast.Node>(source: Ast.Node, target: T): T {
        const comments = source.comments ?? [];

        if (comments.length > 0) {
            target.comments = comments;
        }

        return target;
    }
}
