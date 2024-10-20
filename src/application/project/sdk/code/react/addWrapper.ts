/* eslint-disable no-param-reassign -- False positives */
import {visit} from 'recast';
import {namedTypes as Ast, builders as builder} from 'ast-types';
import {ResultCode, Codemod} from '@/application/project/sdk/code/transformation';

type ComponentDeclaration = Ast.VariableDeclarator|Ast.FunctionDeclaration;
type DeclarationKind = NonNullable<Ast.ExportDeclaration['declaration']>;
type ExpressionKind = Ast.ExpressionStatement['expression'];
type JsxKind = NonNullable<Ast.JSXElement['children']>[number];
type RecastNode<T> = T & {
    extra: {
        parenthesized: boolean,
    },
};

type TargetChildren = {
    parent: Ast.JSXElement,
    index: number,
};

type PropertyTypes = {
    env: {
        name: string,
    },
    literal: {
        value: string|number|boolean|null,
    },
};

type PropertyType = {
    [K in keyof PropertyTypes]: PropertyTypes[K] & {
        type: K,
    }
}[keyof PropertyTypes];

export type WrapperOptions = {
    wrapper: {
        component: string,
        module: string,
        props?: Record<string, PropertyType>,
    },
    targets?: {
        variable?: string,
        component?: string,
    },
    namedExportFallback?: boolean,
};

/**
 * Wraps the exported component with a wrapper component.
 *
 * This transformation is useful for adding wrapper elements such as context providers.
 *
 * It attempts to wrap the default export first, and if not found, it can optionally
 * wrap named exports that return JSX elements depending on the configuration.
 */
export class AddWrapper implements Codemod<Ast.File> {
    private readonly options: WrapperOptions;

    public constructor(options: WrapperOptions) {
        this.options = options;
        this.wrapDeclaration = this.wrapDeclaration.bind(this);
    }

    public apply(input: Ast.File): ResultCode<Ast.File> {
        let modified = false;

        const namedExports: Ast.ExportNamedDeclaration[] = [];
        const {wrapDeclaration} = this;

        visit(input, {
            visitExportDefaultDeclaration: function accept(path) {
                // Wrap the default export
                modified = wrapDeclaration(path.node.declaration, input);

                return this.abort();
            },
            visitExportNamedDeclaration: function accept(path) {
                // Collect named exports for fallback wrapping
                namedExports.push(path.node);

                return false;
            },
        });

        if (!modified && this.options?.namedExportFallback === true) {
            // If the default export was not found, attempt to wrap named exports
            for (const namedExport of namedExports) {
                if (Ast.FunctionDeclaration.check(namedExport.declaration)) {
                    // export function Component() { ... }
                    modified = this.wrapBlockStatement(namedExport.declaration.body);

                    if (modified) {
                        break;
                    }
                }

                if (Ast.VariableDeclaration.check(namedExport.declaration)) {
                    // export const Component = function() { ... };
                    const {declarations} = namedExport.declaration;

                    // Find the first variable declaration that is a variable,
                    // arrow function, or function expression
                    modified = declarations.some(declaration => {
                        if (
                            Ast.VariableDeclarator.check(declaration)
                            && (
                                Ast.Identifier.check(declaration.init)
                                || Ast.ArrowFunctionExpression.check(declaration.init)
                                || Ast.FunctionExpression.check(declaration.init)
                            )
                        ) {
                            return wrapDeclaration(declaration.init, input);
                        }

                        return false;
                    });

                    if (modified) {
                        break;
                    }
                }

                // export {Component as SomeComponent};
                for (const specifier of namedExport.specifiers ?? []) {
                    if (Ast.ExportSpecifier.check(specifier) && Ast.Identifier.check(specifier.local)) {
                        const declaration = this.findComponentDeclaration(input, specifier.local.name);

                        if (
                            declaration !== null
                            && Ast.VariableDeclarator.check(declaration)
                            && Ast.Expression.check(declaration.init)
                        ) {
                            modified = wrapDeclaration(declaration.init, input);

                            if (modified) {
                                break;
                            }
                        }
                    }
                }

                if (modified) {
                    break;
                }
            }
        }

        if (modified) {
            const {body} = input.program;

            body.unshift(
                builder.importDeclaration(
                    [builder.importSpecifier(builder.identifier(this.options.wrapper.component))],
                    builder.literal(this.options.wrapper.module),
                ),
            );
        }

        return {
            modified: modified,
            result: input,
        };
    }

    /**
     * Wraps the declaration with the wrapper component.
     *
     * The declaration can be a function declaration, arrow function,
     * or variable declaration.
     *
     * @param node The declaration to wrap.
     * @param ast The AST representing the source code.
     * @return true if the declaration was wrapped, false otherwise.
     */
    private wrapDeclaration(node: DeclarationKind, ast: Ast.File): boolean {
        if (Ast.ArrowFunctionExpression.check(node)) {
            if (Ast.BlockStatement.check(node.body)) {
                return this.wrapBlockStatement(node.body);
            }

            const result = this.insertWrapper(node.body);

            if (result === null) {
                return false;
            }

            node.body = result;

            return true;
        }

        if (Ast.FunctionExpression.check(node) || Ast.FunctionDeclaration.check(node)) {
            return this.wrapBlockStatement(node.body);
        }

        if (Ast.Identifier.check(node)) {
            // Find the declaration of the component by name
            const declaration = this.findComponentDeclaration(ast, node.name);

            if (declaration !== null) {
                if (Ast.VariableDeclarator.check(declaration)) {
                    const initializer = declaration.init ?? null;

                    if (initializer !== null) {
                        return this.wrapDeclaration(initializer, ast);
                    }
                } else {
                    return this.wrapBlockStatement(declaration.body);
                }
            }
        }

        return false;
    }

    /**
     * Wraps the block statement with the wrapper component.
     *
     * @param node The block statement to wrap
     * @return true if the block statement was wrapped, false otherwise
     */
    private wrapBlockStatement(node: Ast.BlockStatement): boolean {
        const returnStatement = AddWrapper.findReturnStatement(node);
        const argument = returnStatement?.argument ?? null;

        if (returnStatement !== null && argument !== null) {
            const result = this.insertWrapper(argument);

            if (result === null) {
                return false;
            }

            returnStatement.argument = result;

            return true;
        }

        return false;
    }

    /**
     * Wraps the target element with the wrapper component.
     *
     * The given node may not be the target element itself, but a parent
     * that contains the target element. For example, the target element
     * may be a `{children}` expression inside a JSX element.
     *
     * @param node The node containing the target element.
     * @return The modified node with the target element wrapped or the original node if no target is found.
     */
    private insertWrapper(node: ExpressionKind): ExpressionKind|null {
        const target = this.findTargetChildren(node);

        if (target !== null) {
            const {parent, index} = target;

            const children = [...parent.children ?? []];
            const child = children.splice(index, 1)[0] as JsxKind;

            target.parent.children = children.length === 0
                // If there is only one child, replace it with the wrapper
                ? [
                    builder.jsxText('\n'),
                    this.wrapElement(child),
                    builder.jsxText('\n'),
                ]
                // Otherwise, insert the wrapper at the target index
                : [
                    ...children.slice(0, index),
                    this.wrapElement(child),
                    ...children.slice(index),
                ];

            // Parentheses are automatically added by when wrapping an expression,
            // so remove them to avoid double wrapping
            if (AddWrapper.isParenthesized(node)) {
                node.extra.parenthesized = false;
            }

            return node;
        }

        if (
            Ast.JSXText.check(node)
            || Ast.JSXExpressionContainer.check(node)
            || Ast.JSXSpreadChild.check(node)
            || Ast.JSXElement.check(node)
            || Ast.JSXFragment.check(node)
        ) {
            // Parentheses are automatically added by when wrapping an expression,
            // so remove them to avoid double wrapping
            if (AddWrapper.isParenthesized(node)) {
                node.extra.parenthesized = false;
            }

            // Wrap the whole element if the target is not found
            return this.wrapElement(node);
        }

        return null;
    }

    /**
     * Wraps the given JSX element with the wrapper component.
     *
     * @param node The JSX element to wrap.
     * @return The wrapped JSX element.
     */
    private wrapElement(node: JsxKind): Ast.JSXElement {
        return builder.jsxElement.from({
            openingElement: builder.jsxOpeningElement(
                builder.jsxIdentifier(this.options.wrapper.component),
                this.getProviderProps(),
            ),
            closingElement: builder.jsxClosingElement(
                builder.jsxIdentifier(this.options.wrapper.component),
            ),
            children: [
                builder.jsxText('\n'),
                node,
                builder.jsxText('\n'),
            ],
        });
    }

    /**
     * Returns the props for the wrapper component.
     *
     * @return The list of JSX attributes for the wrapper component.
     */
    private getProviderProps(): Ast.JSXAttribute[] {
        const attributes: Ast.JSXAttribute[] = [];
        const props = this.options.wrapper.props ?? {};

        for (const [key, value] of Object.entries(props)) {
            attributes.push(
                builder.jsxAttribute(
                    builder.jsxIdentifier(key),
                    builder.jsxExpressionContainer(
                        value.type === 'env'
                            ? builder.memberExpression(
                                builder.memberExpression(
                                    builder.identifier('process'),
                                    builder.identifier('env'),
                                ),
                                builder.identifier(value.name),
                            )
                            : builder.literal(value.value),
                    ),
                ),
            );
        }

        return attributes;
    }

    /**
     * Finds the declaration of the component by name.
     *
     * @param ast The AST representing the source code.
     * @param name The name of the variable or function to find.
     * @return The declaration of the component or null if not found.
     */
    private findComponentDeclaration(ast: Ast.Node, name: string): ComponentDeclaration|null {
        let componentDeclaration: ComponentDeclaration|null = null;

        visit(ast, {
            visitVariableDeclaration: function accept(path) {
                if (!Ast.Program.check(path.parent.node)) {
                    return false;
                }

                for (const declaration of path.node.declarations) {
                    if (
                        Ast.VariableDeclarator.check(declaration)
                        && Ast.Identifier.check(declaration.id)
                        && declaration.id.name === name
                    ) {
                        componentDeclaration = declaration;

                        return this.abort();
                    }
                }

                return false;
            },
            visitFunctionDeclaration: function accept(path) {
                if (!Ast.Program.check(path.parent.node)) {
                    return false;
                }

                const {id} = path.node;

                if (Ast.Identifier.check(id) && id.name === name) {
                    componentDeclaration = path.node;

                    return this.abort();
                }

                return false;
            },
        });

        return componentDeclaration;
    }

    /**
     * Finds the target children of wrapper component.
     *
     * @param element The element to search for the target.
     * @return The parent element and index of the target children or null if not found.
     */
    private findTargetChildren(element: Ast.Node): TargetChildren | null {
        let insertionPoint: TargetChildren | null = null;
        const {options} = this;

        if (options.targets?.variable === undefined && options.targets?.component === undefined) {
            // If no targets are specified, wrap the whole element
            return null;
        }

        visit(element, {
            visitJSXExpressionContainer: function accept(path) {
                const {expression} = path.node;

                if (
                    options.targets?.variable !== undefined
                    && Ast.Identifier.check(expression)
                    && expression.name === options.targets.variable
                ) {
                    const parent = path.parent.node;

                    insertionPoint = {
                        parent: parent,
                        index: parent.children.indexOf(path.node),
                    };

                    return this.abort();
                }

                return this.traverse(path);
            },
            visitJSXElement: function accept(path) {
                const {openingElement} = path.node;

                if (
                    options.targets?.component !== undefined
                    && Ast.JSXOpeningElement.check(openingElement)
                    && Ast.JSXIdentifier.check(openingElement.name)
                    && openingElement.name.name === options.targets.component
                ) {
                    if (path.parent !== null) {
                        const parent = path.parent.node;

                        insertionPoint = {
                            parent: path.parent.node,
                            index: parent.children.indexOf(path.node),
                        };
                    }
                }

                return this.traverse(path);
            },
        });

        return insertionPoint;
    }

    /**
     * Determines if the node is a parenthesized expression.
     *
     * @param node The node to check.
     * @return true if the node is a parenthesized, false otherwise.
     */
    private static isParenthesized(node: Ast.Node): node is RecastNode<Ast.Node> {
        return 'extra' in node
            && typeof node.extra === 'object'
            && node.extra !== null
            && 'parenthesized' in node.extra
            && node.extra.parenthesized === true;
    }

    /**
     * Finds the return statement in the block statement.
     *
     * @param body The block statement to search for the return statement.
     * @return The return statement or null if not found.
     */
    private static findReturnStatement(body: Ast.BlockStatement): Ast.ReturnStatement | null {
        let returnStatement: Ast.ReturnStatement | null = null;

        visit(body, {
            visitReturnStatement: function accept(path) {
                returnStatement = path.node;

                return this.abort();
            },
        });

        return returnStatement;
    }
}
