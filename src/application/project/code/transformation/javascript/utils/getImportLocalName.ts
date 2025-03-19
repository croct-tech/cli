import * as t from '@babel/types';
import traverse from '@babel/traverse';
import {parse} from '@/application/project/code/transformation/javascript/utils/parse';

export type ImportMatcher = {
    moduleName: string | RegExp,
    importName: string | RegExp,
};

export function getImportLocalName(source: string | t.File, matcher: ImportMatcher): string | null {
    const ast = typeof source === 'string'
        ? parse(source, ['jsx', 'typescript'])
        : source;

    let localName: string | null = null;

    traverse(ast, {
        // import {something} from 'something'
        // import {something as somethingElse} from 'something'
        ImportDeclaration: path => {
            const {node} = path;

            if (!matches(node.source.value, matcher.moduleName)) {
                return path.skip();
            }

            for (const specifier of node.specifiers ?? []) {
                if (t.isImportDefaultSpecifier(specifier)) {
                    if (matches('default', matcher.importName)) {
                        localName = specifier.local.name;
                    }

                    continue;
                }

                if (t.isImportSpecifier(specifier) && matches(specifier.imported, matcher.importName)) {
                    localName = specifier.local.name;

                    return path.skip();
                }
            }

            return path.skip();
        },
    });

    return localName;
}

function matches(value: t.Identifier|t.StringLiteral|string, matcher: string | RegExp): boolean {
    if (typeof value !== 'string') {
        return matches(t.isIdentifier(value) ? value.name : value.value, matcher);
    }

    if (typeof matcher === 'string') {
        return value === matcher;
    }

    return matcher.test(value);
}
