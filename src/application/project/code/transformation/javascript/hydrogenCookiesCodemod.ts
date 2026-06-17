import * as t from '@babel/types';
import {traverse} from '@babel/core';
import {traverseFast} from '@babel/types';
import type {Codemod, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
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
};

type Anchor = {
    response: t.Expression,
    context: t.Expression,
    statements: t.Statement[],
    call: t.CallExpression,
};

/**
 * Writes the Croct visitor cookies after Hydrogen commits its session.
 *
 * Finds the `<response>.headers.set('Set-Cookie', … <context>.session.commit())` statement in the
 * server fetch handler and inserts `<writer>(<response>, <context>)` right after it (so it runs
 * after the session `Set-Cookie`, which is replaced rather than appended). Adds the import.
 * Returns unmodified when the anchor is absent or the writer is already called.
 */
export class HydrogenCookiesCodemod implements Codemod<t.File, CodemodOptions> {
    private readonly configuration: HydrogenCookiesConfiguration;

    public constructor(configuration: HydrogenCookiesConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File): Promise<ResultCode<t.File>> {
        const anchor = HydrogenCookiesCodemod.findAnchor(input);

        if (anchor === null) {
            return Promise.resolve({modified: false, result: input});
        }

        const {writer} = this.configuration;
        const importedName = getImportLocalName(input, {
            moduleName: writer.moduleName,
            importName: writer.importName,
        });

        if (importedName !== null && HydrogenCookiesCodemod.hasCall(anchor.statements, importedName)) {
            return Promise.resolve({modified: false, result: input});
        }

        const {localName} = addImport(input, {
            type: 'value',
            moduleName: writer.moduleName,
            importName: writer.importName,
            localName: writer.localName,
        });

        const index = anchor.statements.findIndex(statement => HydrogenCookiesCodemod.contains(statement, anchor.call));

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

                anchor = {
                    response: response,
                    context: context,
                    statements: fn.node.body.body,
                    call: path.node,
                };

                path.stop();
            },
        });

        return anchor;
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

    private static contains(statement: t.Statement, target: t.Node): boolean {
        let found = false;

        traverseFast(statement, node => {
            if (node === target) {
                found = true;
            }
        });

        return found;
    }
}
