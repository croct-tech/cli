import * as t from '@babel/types';
import traverse from '@babel/traverse';
import {parse} from '@/application/project/sdk/code/parser';

export type ExportMatcher = {
    moduleName: string | RegExp,
    importName?: string | RegExp,
};

export function hasReexport(source: string | t.File, matcher: ExportMatcher): boolean {
    const ast = typeof source === 'string'
        ? parse(source, ['jsx', 'typescript'])
        : source;

    let found = false;

    traverse(ast, {
        // export * from 'something'
        ExportAllDeclaration: function accept(path) {
            const {node} = path;

            if (!t.isStringLiteral(node.source) || !matches(node.source, matcher.moduleName)) {
                return false;
            }

            found = true;

            return false;
        },

        // export {something} from 'something'
        // export {something as somethingElse} from 'something'
        ExportNamedDeclaration: function accept(path) {
            const {node} = path;

            if (!t.isStringLiteral(node.source) || !matches(node.source, matcher.moduleName)) {
                return false;
            }

            if (matcher.importName === undefined) {
                found = true;

                return false;
            }

            for (const specifier of node.specifiers) {
                if (t.isExportSpecifier(specifier) && matches(specifier.local, matcher.importName)) {
                    found = true;

                    return false;
                }
            }

            return false;
        },
    });

    return found;
}

function matches(value: t.Identifier|t.StringLiteral, matcher: string | RegExp): boolean {
    const name = t.isIdentifier(value) ? value.name : value.value;

    if (typeof matcher === 'string') {
        return name === matcher;
    }

    return matcher.test(name);
}
