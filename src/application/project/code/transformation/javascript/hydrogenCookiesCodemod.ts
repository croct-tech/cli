import * as t from '@babel/types';
import {traverse} from '@babel/core';
import {traverseFast} from '@babel/types';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {CodemodError} from '@/application/project/code/transformation/codemod';
import {getImportLocalName} from '@/application/project/code/transformation/javascript/utils/getImportLocalName';
import {addImport} from '@/application/project/code/transformation/javascript/utils/addImport';

export type HydrogenCookiesConfiguration = {
    /**
     * The cookie-writer import to call, e.g. `writeCroctCookies`.
     */
    writer: {
        moduleName: string,
        importName: string,
        localName?: string,
    },

    /**
     * When true, throw if there is no session `Set-Cookie` to anchor to (instead of a silent
     * no-op), so the SDK can report the failure.
     */
    required?: boolean,
};

type Anchor = {
    response: t.Expression,
    context: t.Expression,
    statements: t.Statement[],
    call: t.CallExpression,
    scope: t.Statement[],
};

/**
 * Writes the Croct visitor cookies after Hydrogen commits its session.
 */
export class HydrogenCookiesCodemod implements Codemod<t.File, CodemodOptions> {
    private readonly configuration: HydrogenCookiesConfiguration;

    public constructor(configuration: HydrogenCookiesConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        const anchor = HydrogenCookiesCodemod.findAnchor(input);

        if (anchor === null) {
            if (this.configuration.required === true) {
                throw new CodemodError('No session Set-Cookie statement found to write the Croct cookies after.');
            }

            return Promise.resolve({modified: false, result: input});
        }

        const {writer} = this.configuration;
        const importedName = getImportLocalName(input, {
            moduleName: writer.moduleName,
            importName: writer.importName,
        });

        if (importedName !== null && HydrogenCookiesCodemod.hasCall(anchor.scope, importedName)) {
            return Promise.resolve({modified: false, result: input});
        }

        const {localName} = addImport(input, {
            type: 'value',
            moduleName: writer.moduleName,
            importName: writer.importName,
            localName: writer.localName,
        });

        const index = anchor.statements.findIndex(
            statement => HydrogenCookiesCodemod.contains(statement, anchor.call),
        );

        anchor.statements.splice(
            index + 1,
            0,
            t.expressionStatement(
                t.callExpression(t.identifier(localName), [
                    t.cloneNode(anchor.response),
                    t.cloneNode(anchor.context),
                ]),
            ),
        );

        return Promise.resolve({modified: true, result: input});
    }

    private static findAnchor(ast: t.File): Anchor | null {
        let anchor: Anchor | null = null;

        traverse(ast, {
            CallExpression: path => {
                const response = HydrogenCookiesCodemod.matchSetCookie(path.node);

                if (response === null) {
                    return;
                }

                const fn = path.getFunctionParent();

                if (fn === null || !t.isBlockStatement(fn.node.body)) {
                    return;
                }

                const context = HydrogenCookiesCodemod.findSessionContext(path.node);

                if (context === null) {
                    return;
                }

                // Insert in the block that holds the session cookie — the wrapping `try`, if any,
                // so the writer runs before `return response`, not after the try/catch. A guarding
                // `if (session.isPending) { … }` is handled by `findIndex`/`contains` below, which
                // resolves to the whole guard statement rather than the nested set call.
                const tryStatement = fn.node
                    .body
                    .body
                    .find(
                        (statement): statement is t.TryStatement => t.isTryStatement(statement)
                        && HydrogenCookiesCodemod.contains(statement.block, path.node),
                    );

                anchor = {
                    response: response,
                    context: context,
                    statements: tryStatement !== undefined ? tryStatement.block.body : fn.node.body.body,
                    call: path.node,
                    scope: fn.node.body.body,
                };

                path.stop();
            },
        });

        return anchor;
    }

    /**
     * Whether the node contains the target node anywhere within it.
     */
    private static contains(node: t.Node, target: t.Node): boolean {
        let found = false;

        traverseFast(node, current => {
            if (current === target) {
                found = true;
            }
        });

        return found;
    }

    /**
     * Returns the response expression of a `<response>.headers.set('Set-Cookie', …)` call.
     */
    private static matchSetCookie(node: t.CallExpression): t.Expression | null {
        const {callee} = node;

        if (
            !t.isMemberExpression(callee)
            || callee.computed
            || !t.isIdentifier(callee.property)
            || callee.property.name !== 'set'
        ) {
            return null;
        }

        const headers = callee.object;

        if (
            !t.isMemberExpression(headers)
            || headers.computed
            || !t.isIdentifier(headers.property)
            || headers.property.name !== 'headers'
        ) {
            return null;
        }

        const [first] = node.arguments;

        if (first === undefined || !t.isStringLiteral(first) || first.value !== 'Set-Cookie') {
            return null;
        }

        return headers.object;
    }

    /**
     * Returns the object of the first `<context>.session` member access within the node.
     */
    private static findSessionContext(node: t.Node): t.Expression | null {
        let context: t.Expression | null = null;

        traverseFast(node, current => {
            if (
                context === null
                && t.isMemberExpression(current)
                && !current.computed
                && t.isIdentifier(current.property)
                && current.property.name === 'session'
            ) {
                context = current.object;
            }
        });

        return context;
    }

    private static hasCall(statements: t.Statement[], localName: string): boolean {
        return statements.some(statement => {
            let called = false;

            traverseFast(statement, node => {
                if (called || !t.isCallExpression(node) || !t.isIdentifier(node.callee)) {
                    return;
                }

                called = node.callee.name === localName;
            });

            return called;
        });
    }
}
