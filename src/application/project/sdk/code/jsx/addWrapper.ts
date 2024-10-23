/* eslint-disable no-param-reassign -- False positives */
import * as t from '@babel/types';
import traverse from '@babel/traverse';
import {traverseFast} from '@babel/types';
import {ResultCode, Codemod} from '@/application/project/sdk/code/codemod';
import {addImport} from '@/application/project/sdk/code/javascript/addImport';

type ComponentDeclaration = t.VariableDeclarator | t.FunctionDeclaration;
type DeclarationKind = t.ExportDefaultDeclaration['declaration'];
type ExpressionKind = t.Expression;
type JsxKind = t.JSXElement['children'][number];

type TargetChildren = {
    parent: t.JSXElement,
    index: number,
};

type PropertyTypes = {
    env: {
        name: string,
    },
    literal: {
        value: string | number | boolean | null,
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
export class AddWrapper implements Codemod<t.File> {
    private readonly options: WrapperOptions;

    public constructor(options: WrapperOptions) {
        this.options = options;
        this.wrapDeclaration = this.wrapDeclaration.bind(this);
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        let modified = false;

        const namedExports: t.ExportNamedDeclaration[] = [];
        const {wrapDeclaration} = this;

        const ast = t.cloneNode(input, true);

        const componentImport = addImport(ast, {
            type: 'value',
            moduleName: this.options.wrapper.module,
            importName: this.options.wrapper.component,
        });

        const component = componentImport.localName ?? this.options.wrapper.component;

        traverse(ast, {
            ExportDefaultDeclaration: function accept(path) {
                // Wrap the default export
                modified = wrapDeclaration(path.node.declaration, component, ast);

                return path.stop();
            },
            ExportNamedDeclaration: function accept(path) {
                // Collect named exports for fallback wrapping
                namedExports.push(path.node);

                return path.skip();
            },
        });

        if (!modified && this.options?.namedExportFallback === true) {
            // If the default export was not found, attempt to wrap named exports
            for (const namedExport of namedExports) {
                if (t.isFunctionDeclaration(namedExport.declaration)) {
                    // export function Component() { ... }
                    modified = this.wrapBlockStatement(namedExport.declaration.body, component, ast);

                    if (modified) {
                        break;
                    }
                }

                if (t.isVariableDeclaration(namedExport.declaration)) {
                    // export const Component = function() { ... };
                    const {declarations} = namedExport.declaration;

                    // Find the first variable declaration that is a variable,
                    // arrow function, or function expression
                    modified = declarations.some(declaration => {
                        if (
                            t.isIdentifier(declaration.init)
                            || t.isArrowFunctionExpression(declaration.init)
                            || t.isFunctionExpression(declaration.init)
                        ) {
                            return wrapDeclaration(declaration.init, component, ast);
                        }

                        return false;
                    });

                    if (modified) {
                        break;
                    }
                }

                // export {Component as SomeComponent};
                for (const specifier of namedExport.specifiers ?? []) {
                    if (t.isExportSpecifier(specifier)) {
                        const declaration = this.findComponentDeclaration(ast, specifier.local.name);

                        if (
                            declaration !== null
                            && t.isVariableDeclarator(declaration)
                            && t.isExpression(declaration.init)
                        ) {
                            modified = wrapDeclaration(declaration.init, component, ast);

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

        return Promise.resolve({
            modified: modified,
            result: modified ? ast : input,
        });
    }

    /**
     * Wraps the declaration with the wrapper component.
     *
     * The declaration can be a function declaration, arrow function,
     * or variable declaration.
     *
     * @param node The declaration to wrap.
     * @param component The name of the component to use as the wrapper.
     * @param ast The AST representing the source code.
     * @return true if the declaration was wrapped, false otherwise.
     */
    private wrapDeclaration(node: DeclarationKind, component: string, ast: t.File): boolean {
        if (t.isArrowFunctionExpression(node)) {
            if (t.isBlockStatement(node.body)) {
                return this.wrapBlockStatement(node.body, component, ast);
            }

            const result = this.insertWrapper(node.body, component, ast);

            if (result === null) {
                return false;
            }

            node.body = result;

            return true;
        }

        if (t.isFunctionExpression(node) || t.isFunctionDeclaration(node)) {
            return this.wrapBlockStatement(node.body, component, ast);
        }

        if (t.isIdentifier(node)) {
            // Find the declaration of the component by name
            const declaration = this.findComponentDeclaration(ast, node.name);

            if (declaration !== null) {
                if (t.isVariableDeclarator(declaration)) {
                    const initializer = declaration.init ?? null;

                    if (initializer !== null) {
                        return this.wrapDeclaration(initializer, component, ast);
                    }
                } else {
                    return this.wrapBlockStatement(declaration.body, component, ast);
                }
            }
        }

        return false;
    }

    /**
     * Wraps the block statement with the wrapper component.
     *
     * @param node The block statement to wrap
     * @param component The name of the component to use as the wrapper.
     * @param ast The AST representing the source code.
     * @return true if the block statement was wrapped, false otherwise
     */
    private wrapBlockStatement(node: t.BlockStatement, component: string, ast: t.File): boolean {
        const returnStatement = AddWrapper.findReturnStatement(node);
        const argument = returnStatement?.argument ?? null;

        if (returnStatement !== null && argument !== null) {
            const result = this.insertWrapper(argument, component, ast);

            if (result === null) {
                return false;
            }

            returnStatement.argument = t.parenthesizedExpression(result);

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
     * @param component The name of the component to use as the wrapper.
     * @param ast The AST representing the source code.
     * @return The modified node with the target element wrapped or the original node if no target is found.
     */
    private insertWrapper(node: ExpressionKind, component: string, ast: t.File): ExpressionKind | null {
        if (this.containsElement(node, component)) {
            return null;
        }

        const target = this.findTargetChildren(ast, node);

        if (target !== null) {
            const {parent, index} = target;

            const children = [...parent.children ?? []];
            const child = children.splice(index, 1)[0] as JsxKind;

            target.parent.children = children.length === 0
                // If there is only one child, replace it with the wrapper
                ? [
                    t.jsxText('\n'),
                    this.wrapElement(child, component),
                    t.jsxText('\n'),
                ]
                // Otherwise, insert the wrapper at the target index
                : [
                    ...children.slice(0, index),
                    this.wrapElement(child, component),
                    ...children.slice(index),
                ];

            return node;
        }

        if (
            t.isJSXText(node)
            || t.isJSXExpressionContainer(node)
            || t.isJSXSpreadChild(node)
            || t.isJSXElement(node)
            || t.isJSXFragment(node)
        ) {
            // Wrap the whole element if the target is not found
            return this.wrapElement(node, component);
        }

        return null;
    }

    /**
     * Wraps the given JSX element with the wrapper component.
     *
     * @param node The JSX element to wrap.
     * @param name The name of the component to use as the wrapper.
     * @return The wrapped JSX element.
     */
    private wrapElement(node: JsxKind, name?: string): t.JSXElement {
        return t.jsxElement(
            t.jsxOpeningElement(
                t.jsxIdentifier(name ?? this.options.wrapper.component),
                this.getProviderProps(),
            ),
            t.jsxClosingElement(
                t.jsxIdentifier(name ?? this.options.wrapper.component),
            ),
            [
                t.jsxText('\n'),
                node,
                t.jsxText('\n'),
            ],
        );
    }

    /**
     * Returns the props for the wrapper component.
     *
     * @return The list of JSX attributes for the wrapper component.
     */
    private getProviderProps(): t.JSXAttribute[] {
        const attributes: t.JSXAttribute[] = [];
        const props = this.options.wrapper.props ?? {};

        for (const [key, value] of Object.entries(props)) {
            attributes.push(
                t.jsxAttribute(
                    t.jsxIdentifier(key),
                    t.jsxExpressionContainer(
                        value.type === 'env'
                            ? t.memberExpression(
                                t.memberExpression(
                                    t.identifier('process'),
                                    t.identifier('env'),
                                ),
                                t.identifier(value.name),
                            )
                            : AddWrapper.getLiteralValue(value.value),
                    ),
                ),
            );
        }

        return attributes;
    }

    /**
     * Returns the literal value as an AST node.
     *
     * @param value The value to represent as an AST node.
     * @return The AST node representing the value.
     */
    private static getLiteralValue(
        value: string | number | boolean | null,
    ): t.StringLiteral | t.NumericLiteral | t.BooleanLiteral | t.NullLiteral {
        if (typeof value === 'string') {
            return t.stringLiteral(value);
        }

        if (typeof value === 'number') {
            return t.numericLiteral(value);
        }

        if (typeof value === 'boolean') {
            return t.booleanLiteral(value);
        }

        return t.nullLiteral();
    }

    /**
     * Determines if the element contains the specified component.
     *
     * @param parent The parent element to search for the component.
     * @param name The name of the component to find.
     * @return true if the element contains the component, false otherwise.
     */
    private containsElement(parent: t.Node, name: string): boolean {
        let contains = false;

        traverseFast(parent, node => {
            if (
                !contains
                && t.isJSXOpeningElement(node)
                && t.isJSXIdentifier(node.name)
                && node.name.name === name
            ) {
                contains = true;
            }
        });

        return contains;
    }

    /**
     * Finds the declaration of the component by name.
     *
     * @param ast The AST representing the source code.
     * @param name The name of the variable or function to find.
     * @return The declaration of the component or null if not found.
     */
    private findComponentDeclaration(ast: t.File, name: string): ComponentDeclaration | null {
        let componentDeclaration: ComponentDeclaration | null = null;

        traverse(ast, {
            VariableDeclaration: function accept(path) {
                if (!t.isProgram(path.parent)) {
                    return false;
                }

                for (const declaration of path.node.declarations) {
                    if (
                        t.isVariableDeclarator(declaration)
                        && t.isIdentifier(declaration.id)
                        && declaration.id.name === name
                    ) {
                        componentDeclaration = declaration;

                        return path.stop();
                    }
                }

                return false;
            },
            FunctionDeclaration: function accept(path) {
                if (!t.isProgram(path.parent)) {
                    return false;
                }

                const {id} = path.node;

                if (t.isIdentifier(id) && id.name === name) {
                    componentDeclaration = path.node;

                    return path.stop();
                }

                return false;
            },
        });

        return componentDeclaration;
    }

    /**
     * Finds the target children of wrapper component.
     *
     * @param ast The AST representing the source code.
     * @param element The element to search for the target.
     * @return The parent element and index of the target children or null if not found.
     */
    private findTargetChildren(ast: t.File, element: t.Node): TargetChildren | null {
        let insertionPoint: TargetChildren | null = null;
        const {options} = this;

        if (options.targets?.variable === undefined && options.targets?.component === undefined) {
            // If no targets are specified, wrap the whole element
            return null;
        }

        traverse(ast, {
            enter: function enter(path) {
                const {node} = path;

                if (node !== element) {
                    return;
                }

                path.traverse({
                    JSXExpressionContainer: function accept(nestedPath) {
                        const {expression} = nestedPath.node;

                        if (
                            options.targets?.variable !== undefined
                            && t.isIdentifier(expression)
                            && expression.name === options.targets.variable
                        ) {
                            const parent = nestedPath.parent as t.JSXElement;

                            insertionPoint = {
                                parent: parent,
                                index: parent.children.indexOf(nestedPath.node),
                            };

                            return nestedPath.stop();
                        }
                    },
                    JSXElement: function accept(nestedPath) {
                        const {openingElement} = nestedPath.node;

                        if (
                            options.targets?.component !== undefined
                            && t.isJSXOpeningElement(openingElement)
                            && t.isJSXIdentifier(openingElement.name)
                            && openingElement.name.name === options.targets.component
                        ) {
                            if (nestedPath.parent !== null) {
                                const parent = nestedPath.parent as t.JSXElement;

                                insertionPoint = {
                                    parent: parent,
                                    index: parent.children.indexOf(nestedPath.node),
                                };
                            }
                        }
                    },
                });

                return path.stop();
            },
        });

        return insertionPoint;
    }

    /**
     * Finds the return statement in the block statement.
     *
     * @param body The block statement to search for the return statement.
     * @return The return statement or null if not found.
     */
    private static findReturnStatement(body: t.BlockStatement): t.ReturnStatement | null {
        let returnStatement: t.ReturnStatement | null = null;

        traverseFast(body, node => {
            if (returnStatement === null && t.isReturnStatement(node)) {
                returnStatement = node;
            }
        });

        return returnStatement;
    }
}
