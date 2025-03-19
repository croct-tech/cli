import * as t from '@babel/types';
import traverse from '@babel/traverse';
import {parse} from '@/application/project/code/transformation/javascript/utils/parse';

export type ImportMatcher = {
    moduleName: string | RegExp,
    importName?: string | RegExp,
    localName?: string | RegExp,
};

export function hasImport(source: string | t.File, matcher: ImportMatcher): boolean {
    const ast = typeof source === 'string'
        ? parse(source, ['jsx', 'typescript'])
        : source;

    let found = false;

    traverse(ast, {
        // import {something} from 'something'
        // import {something as somethingElse} from 'something'
        ImportDeclaration: path => {
            const {node} = path;

            if (!matches(node.source, matcher.moduleName)) {
                return path.skip();
            }

            if (matcher.importName === undefined && matcher.localName === undefined) {
                found = true;

                return path.stop();
            }

            for (const specifier of node.specifiers ?? []) {
                if (
                    t.isImportSpecifier(specifier)
                    && (matcher.importName === undefined || matches(specifier.imported, matcher.importName))
                    && (matcher.localName === undefined || matches(specifier.local, matcher.localName))
                ) {
                    found = true;

                    return path.stop();
                }
            }

            return path.skip();
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
