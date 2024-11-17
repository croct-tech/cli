/* eslint-disable no-param-reassign -- False positives */
import * as t from '@babel/types';
import traverse from '@babel/traverse';
import {traverseFast} from '@babel/types';
import {ResultCode, Codemod, CodemodOptions} from '@/application/project/sdk/code/codemod';
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
    property: {
        path: string[],
    },
    literal: {
        value: string | number | boolean | null,
    },
    ternary: {
        condition: {
            left: PropertyType,
            operator: '===' | '!==' | '>' | '>=' | '<' | '<=',
            right: PropertyType,
        },
        consequent: PropertyType,
        alternate: PropertyType,
    },
};

type PropertyType = {
    [K in keyof PropertyTypes]: PropertyTypes[K] & {type: K}
}[keyof PropertyTypes];

export type WrapperConfiguration<O extends CodemodOptions = CodemodOptions> = {
    wrapper: {
        component: string,
        module: string,
        props?: Record<string, PropertyType>,
    },
    targets?: {
        variable?: string,
        component?: string,
    },
    fallbackToNamedExports?: boolean,
    fallbackCodemod?: Codemod<t.File, O>,
};

export type WrapperOptions = CodemodOptions & {
    props?: Record<string, PropertyType>,
};

enum Transformation {
    APPLIED,
    NOT_APPLIED,
    ALREADY_APPLIED,
}

type WrapperInsertion = {
    result: Transformation,
    node: t.Expression,
};

/**
 * Wraps the exported component with a wrapper component.
 *
 * This transformation is useful for adding wrapper elements such as context providers.
 *
 * It attempts to wrap the default export first, and if not found, it can optionally
 * wrap named exports that return JSX elements depending on the configuration.
 */
export class AddWrapper<O extends WrapperOptions = WrapperOptions> implements Codemod<t.File> {
    private readonly configuration: WrapperConfiguration<O>;

    public constructor(configuration: WrapperConfiguration<O>) {
        this.configuration = configuration;
    }

    public apply(input: t.File, options: O): Promise<ResultCode<t.File>> {
        const ast = t.cloneNode(input, true);

        const componentImport = addImport(ast, {
            type: 'value',
            moduleName: this.configuration.wrapper.module,
            importName: this.configuration.wrapper.component,
        });

        const component = componentImport.localName ?? this.configuration.wrapper.component;
        const namedExports: t.ExportNamedDeclaration[] = [];

        let result = Transformation.NOT_APPLIED;

        traverse(ast, {
            ExportDefaultDeclaration: path => {
                // Wrap the default export
                result = this.wrapDeclaration(path.node.declaration, component, ast, options);

                return path.stop();
            },
            ExportNamedDeclaration: path => {
                // Collect named exports for fallback wrapping
                namedExports.push(path.node);

                return path.skip();
            },
        });

        if (result === Transformation.NOT_APPLIED && this.configuration?.fallbackToNamedExports === true) {
            // If the default export was not found, attempt to wrap named exports
            for (const namedExport of namedExports) {
                if (t.isFunctionDeclaration(namedExport.declaration)) {
                    // export function Component() { ... }
                    result = this.wrapBlockStatement(namedExport.declaration.body, component, ast, options);

                    if (result === Transformation.APPLIED) {
                        break;
                    }
                }

                if (t.isVariableDeclaration(namedExport.declaration)) {
                    // export const Component = function() { ... };
                    const {declarations} = namedExport.declaration;

                    // Find the first variable declaration that is a variable,
                    // arrow function, or function expression
                    const modified = declarations.some(declaration => {
                        if (
                            t.isIdentifier(declaration.init)
                            || t.isArrowFunctionExpression(declaration.init)
                            || t.isFunctionExpression(declaration.init)
                        ) {
                            return this.wrapDeclaration(declaration.init, component, ast, options)
                                === Transformation.APPLIED;
                        }

                        return false;
                    });

                    if (modified) {
                        result = Transformation.APPLIED;

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
                            result = this.wrapDeclaration(declaration.init, component, ast, options);

                            if (result === Transformation.APPLIED) {
                                break;
                            }
                        }
                    }
                }

                if (result === Transformation.APPLIED) {
                    break;
                }
            }
        }

        const fallbackCodemod = this.configuration?.fallbackCodemod;

        if (result === Transformation.NOT_APPLIED && fallbackCodemod !== undefined) {
            return fallbackCodemod.apply(input, options);
        }

        return Promise.resolve({
            modified: result === Transformation.APPLIED,
            result: result === Transformation.APPLIED ? ast : input,
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
     * @return the result of the transformation.
     */
    private wrapDeclaration(node: DeclarationKind, component: string, ast: t.File, options: O): Transformation {
        if (t.isArrowFunctionExpression(node)) {
            if (t.isBlockStatement(node.body)) {
                return this.wrapBlockStatement(node.body, component, ast, options);
            }

            const insertion = this.insertWrapper(node.body, component, ast, options);

            if (insertion.result !== Transformation.APPLIED) {
                return insertion.result;
            }

            node.body = insertion.node;

            return Transformation.APPLIED;
        }

        if (t.isFunctionExpression(node) || t.isFunctionDeclaration(node)) {
            return this.wrapBlockStatement(node.body, component, ast, options);
        }

        if (t.isIdentifier(node)) {
            // Find the declaration of the component by name
            const declaration = this.findComponentDeclaration(ast, node.name);

            if (declaration !== null) {
                if (t.isVariableDeclarator(declaration)) {
                    const initializer = declaration.init ?? null;

                    if (initializer !== null) {
                        return this.wrapDeclaration(initializer, component, ast, options);
                    }
                } else {
                    return this.wrapBlockStatement(declaration.body, component, ast, options);
                }
            }
        }

        return Transformation.NOT_APPLIED;
    }

    /**
     * Wraps the block statement with the wrapper component.
     *
     * @param node The block statement to wrap
     * @param component The name of the component to use as the wrapper.
     * @param ast The AST representing the source code.
     * @return the result of the transformation.
     */
    private wrapBlockStatement(node: t.BlockStatement, component: string, ast: t.File, options: O): Transformation {
        const returnStatement = AddWrapper.findReturnStatement(node);
        const argument = returnStatement?.argument ?? null;

        if (returnStatement !== null && argument !== null) {
            const insertion = this.insertWrapper(argument, component, ast, options);

            if (insertion.result !== Transformation.APPLIED) {
                return insertion.result;
            }

            returnStatement.argument = t.parenthesizedExpression(insertion.node);

            return Transformation.APPLIED;
        }

        return Transformation.NOT_APPLIED;
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
     * @return The result of the transformation.
     */
    private insertWrapper(node: ExpressionKind, component: string, ast: t.File, options: O): WrapperInsertion {
        if (this.containsElement(node, component)) {
            return {
                result: Transformation.ALREADY_APPLIED,
                node: node,
            };
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
                    this.wrapElement(child, component, options),
                    t.jsxText('\n'),
                ]
                // Otherwise, insert the wrapper at the target index
                : [
                    ...children.slice(0, index),
                    this.wrapElement(child, component, options),
                    ...children.slice(index),
                ];

            return {
                result: Transformation.APPLIED,
                node: node,
            };
        }

        if (
            t.isJSXText(node)
            || t.isJSXExpressionContainer(node)
            || t.isJSXSpreadChild(node)
            || t.isJSXElement(node)
            || t.isJSXFragment(node)
        ) {
            // Wrap the whole element if the target is not found
            return {
                result: Transformation.APPLIED,
                node: this.wrapElement(node, component, options),
            };
        }

        return {
            result: Transformation.NOT_APPLIED,
            node: node,
        };
    }

    /**
     * Wraps the given JSX element with the wrapper component.
     *
     * @param node The JSX element to wrap.
     * @param name The name of the component to use as the wrapper.
     * @param options The wrapper options.
     * @return The wrapped JSX element.
     */
    private wrapElement(node: JsxKind, name: string|undefined, options: O): t.JSXElement {
        return t.jsxElement(
            t.jsxOpeningElement(
                t.jsxIdentifier(name ?? this.configuration.wrapper.component),
                this.getProviderProps(options),
            ),
            t.jsxClosingElement(
                t.jsxIdentifier(name ?? this.configuration.wrapper.component),
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
    private getProviderProps(options: O): t.JSXAttribute[] {
        const attributes: t.JSXAttribute[] = [];
        const props = {...this.configuration.wrapper.props, ...options.props};

        for (const [key, value] of Object.entries(props)) {
            attributes.push(
                t.jsxAttribute(
                    t.jsxIdentifier(key),
                    t.jsxExpressionContainer(AddWrapper.buildPropertyExpression(value)),
                ),
            );
        }

        return attributes;
    }

    private static buildPropertyExpression(property: PropertyType): t.Expression {
        switch (property.type) {
            case 'property':
                if (property.path.length < 2) {
                    return t.identifier(property.path[0]);
                }

                return property.path
                    .slice(2)
                    .reduce(
                        (object, key) => t.memberExpression(object, t.identifier(key)),
                        t.memberExpression(
                            t.identifier(property.path[0]),
                            t.identifier(property.path[1]),
                        ),
                    );

            case 'literal':
                if (typeof property.value === 'string') {
                    return t.stringLiteral(property.value);
                }

                if (typeof property.value === 'number') {
                    return t.numericLiteral(property.value);
                }

                if (typeof property.value === 'boolean') {
                    return t.booleanLiteral(property.value);
                }

                return t.nullLiteral();

            case 'ternary':
                return t.conditionalExpression(
                    t.binaryExpression(
                        property.condition.operator,
                        this.buildPropertyExpression(property.condition.left),
                        this.buildPropertyExpression(property.condition.right),
                    ),
                    this.buildPropertyExpression(property.consequent),
                    this.buildPropertyExpression(property.alternate),
                );
        }
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
            VariableDeclaration: path => {
                if (!t.isProgram(path.parent)) {
                    return path.skip();
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

                return path.skip();
            },
            FunctionDeclaration: path => {
                if (!t.isProgram(path.parent)) {
                    return path.skip();
                }

                const {id} = path.node;

                if (t.isIdentifier(id) && id.name === name) {
                    componentDeclaration = path.node;

                    return path.stop();
                }

                return path.skip();
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
        const {configuration} = this;

        if (configuration.targets?.variable === undefined && configuration.targets?.component === undefined) {
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
                    JSXExpressionContainer: nestedPath => {
                        const {expression} = nestedPath.node;

                        if (
                            configuration.targets?.variable !== undefined
                            && t.isIdentifier(expression)
                            && expression.name === configuration.targets.variable
                        ) {
                            const parent = nestedPath.parent as t.JSXElement;

                            insertionPoint = {
                                parent: parent,
                                index: parent.children.indexOf(nestedPath.node),
                            };

                            return nestedPath.stop();
                        }
                    },
                    JSXElement: nestedPath => {
                        const {openingElement} = nestedPath.node;

                        if (
                            configuration.targets?.component !== undefined
                            && t.isJSXOpeningElement(openingElement)
                            && t.isJSXIdentifier(openingElement.name)
                            && openingElement.name.name === configuration.targets.component
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
