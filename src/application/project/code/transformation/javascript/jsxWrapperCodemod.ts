/* eslint-disable no-param-reassign -- False positives */
import * as t from '@babel/types';
import {traverse} from '@babel/core';
import {traverseFast} from '@babel/types';
import type {ResultCode, Codemod, CodemodOptions} from '@/application/project/code/transformation/codemod';
import {addImport} from '@/application/project/code/transformation/javascript/utils/addImport';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';
import type {AttributeType} from '@/application/project/code/transformation/javascript/utils/createJsxProps';
import {createJsxAttributes} from '@/application/project/code/transformation/javascript/utils/createJsxProps';

type ComponentDeclaration = t.VariableDeclarator | t.FunctionDeclaration;
type DeclarationKind = t.ExportDefaultDeclaration['declaration'];
type ExpressionKind = t.Expression;
type JsxKind = t.JSXElement['children'][number];

type TargetChildren = {
    parent: t.JSXElement,
    index: number,
};

/**
 * Wraps the `{name}` expression child (e.g. `children`).
 */
export type VariableTarget = {
    variable: string,
    component?: never,
    container?: never,
};

/**
 * Wraps the matched `<Name>` element itself. `Name` may be dotted (e.g. `Foo.Bar`) or namespaced.
 */
export type ComponentTarget = {
    component: string,
    variable?: never,
    container?: never,
};

/**
 * Wraps its children, nesting the former children inside the wrapper.
 */
export type ContainerTarget = {
    container: string,
    variable?: never,
    component?: never,
};

/**
 * Selects what the wrapper wraps.
 */
export type WrapperTarget = VariableTarget | ComponentTarget | ContainerTarget;

export type WrapperConfiguration<O extends CodemodOptions = CodemodOptions> = {
    wrapper: {
        component: string,
        module: string,
        props?: Record<string, AttributeType>,
    },
    targets?: WrapperTarget,
    fallbackToNamedExports?: boolean,
    fallbackCodemod?: Codemod<t.File, O>,
};

export type WrapperOptions = CodemodOptions & {
    props?: Record<string, AttributeType>,
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
export class JsxWrapperCodemod<O extends WrapperOptions = WrapperOptions> implements Codemod<t.File> {
    private readonly configuration: WrapperConfiguration<O>;

    public constructor(configuration: WrapperConfiguration<O>) {
        this.configuration = configuration;
    }

    public apply(input: t.File, options?: O): Promise<ResultCode<t.File>> {
        const importLocalName = getImportLocalName(input, {
            importName: this.configuration.wrapper.component,
            moduleName: this.configuration.wrapper.module,
        });

        const component = importLocalName ?? this.configuration.wrapper.component;
        const namedExports: t.ExportNamedDeclaration[] = [];

        let result = Transformation.NOT_APPLIED;

        traverse(input, {
            ExportDefaultDeclaration: path => {
                // Wrap the default export
                result = this.wrapDeclaration(path.node.declaration, component, input, options);

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
                    result = this.wrapBlockStatement(namedExport.declaration.body, component, input, options);

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
                            return this.wrapDeclaration(declaration.init, component, input, options)
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
                        const declaration = this.findComponentDeclaration(input, specifier.local.name);

                        if (
                            declaration !== null
                            && t.isVariableDeclarator(declaration)
                            && t.isExpression(declaration.init)
                        ) {
                            result = this.wrapDeclaration(declaration.init, component, input, options);

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

        if (result === Transformation.APPLIED && importLocalName === null) {
            const {body} = input.program;

            if (!t.isImportDeclaration(body[0])) {
                // Workaround to add a new line after the import statement
                body.unshift(t.emptyStatement());
            }

            addImport(input, {
                type: 'value',
                moduleName: this.configuration.wrapper.module,
                importName: this.configuration.wrapper.component,
            });
        }

        const fallbackCodemod = this.configuration?.fallbackCodemod;

        if (result === Transformation.NOT_APPLIED && fallbackCodemod !== undefined) {
            return fallbackCodemod.apply(input, options);
        }

        return Promise.resolve({
            modified: result === Transformation.APPLIED,
            result: input,
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
     * @param options The wrapper options.
     * @return the result of the transformation.
     */
    private wrapDeclaration(node: DeclarationKind, component: string, ast: t.File, options?: O): Transformation {
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
     * @param options The wrapper options.
     * @return the result of the transformation.
     */
    private wrapBlockStatement(node: t.BlockStatement, component: string, ast: t.File, options?: O): Transformation {
        const returnStatement = JsxWrapperCodemod.findReturnStatement(node);
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
     * @param options The wrapper options.
     * @return The result of the transformation.
     */
    private insertWrapper(node: ExpressionKind, component: string, ast: t.File, options?: O): WrapperInsertion {
        if (this.containsElement(node, component)) {
            return {
                result: Transformation.ALREADY_APPLIED,
                node: node,
            };
        }

        const container = this.configuration.targets?.container;

        if (container !== undefined) {
            return this.wrapElementChildren(
                node,
                JsxWrapperCodemod.resolveElementName(ast, container),
                component,
                options,
            );
        }

        const target = this.findTargetChildren(ast, node);

        if (target !== null) {
            const {parent, index} = target;

            const children = [...parent.children ?? []];
            const child = children.splice(index, 1)[0];

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
    private wrapElement(node: JsxKind, name: string | undefined, options?: O): t.JSXElement {
        if (node.extra?.parenthesized === true) {
            node.extra.parenthesized = false;
        }

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
    private getProviderProps(options?: O): t.JSXAttribute[] {
        return createJsxAttributes({...this.configuration.wrapper.props, ...options?.props});
    }

    /**
     * Wraps the children of the named element with the wrapper component, in place.
     *
     * The element stays where it is and the wrapper becomes its single child, nesting the
     * former children inside. Returns NOT_APPLIED when the element is absent or has no content
     * to wrap, so the caller can fall back to other exports.
     */
    private wrapElementChildren(node: ExpressionKind, name: string, component: string, options?: O): WrapperInsertion {
        const element = this.findElement(node, name);

        if (element === null) {
            return {result: Transformation.NOT_APPLIED, node: node};
        }

        const hasContent = element.children.some(child => !t.isJSXText(child) || child.value.trim() !== '');

        if (!hasContent) {
            return {result: Transformation.NOT_APPLIED, node: node};
        }

        element.children = [
            t.jsxText('\n'),
            t.jsxElement(
                t.jsxOpeningElement(t.jsxIdentifier(component), this.getProviderProps(options)),
                t.jsxClosingElement(t.jsxIdentifier(component)),
                [t.jsxText('\n'), ...element.children, t.jsxText('\n')],
            ),
            t.jsxText('\n'),
        ];

        return {result: Transformation.APPLIED, node: node};
    }

    /**
     * Finds the first JSX element whose opening name matches the given (dotted) name.
     */
    private findElement(node: t.Node, name: string): t.JSXElement | null {
        let element: t.JSXElement | null = null;

        traverseFast(node, current => {
            if (
                element === null
                && t.isJSXElement(current)
                && JsxWrapperCodemod.getJsxName(current.openingElement.name) === name
            ) {
                element = current;
            }
        });

        return element;
    }

    /**
     * Returns the dotted name of a JSX element name (identifier, member expression, or namespace).
     */
    private static getJsxName(name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName): string {
        if (t.isJSXMemberExpression(name)) {
            return `${JsxWrapperCodemod.getJsxName(name.object)}.${JsxWrapperCodemod.getJsxName(name.property)}`;
        }

        if (t.isJSXNamespacedName(name)) {
            return `${name.namespace.name}:${name.name.name}`;
        }

        return name.name;
    }

    /**
     * Resolves the import alias of a target element name's root identifier, so an aliased import
     * (e.g. `import {Analytics as Shopify}`) still matches `<Shopify.Provider>` for the configured
     * `Analytics.Provider`. The root is matched against any module, leaving it untouched when it is
     * not an imported binding.
     */
    private static resolveElementName(ast: t.File, name: string): string {
        const segments = name.split('.');
        const local = getImportLocalName(ast, {moduleName: /.*/, importName: segments[0]});

        if (local !== null) {
            segments[0] = local;
        }

        return segments.join('.');
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

        const componentName = configuration.targets?.component === undefined
            ? undefined
            : JsxWrapperCodemod.resolveElementName(ast, configuration.targets.component);

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
                            componentName !== undefined
                            && JsxWrapperCodemod.getJsxName(openingElement.name) === componentName
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
