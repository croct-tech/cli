import * as t from '@babel/types';
import {traverse} from '@babel/core';
import {parse} from '@/application/project/code/transformation/javascript/utils/parse';

/**
 * Returns the module specifier from which the given value is imported, or null when it is not
 * imported anywhere.
 *
 * The inverse of `getImportLocalName`: it answers "where does this come from?". Default imports are
 * matched against `default`, namespace imports against `*`, and named imports against their
 * imported (not local) name.
 */
export function getImportSource(source: string | t.File, importName: string | RegExp): string | null {
    const ast = typeof source === 'string'
        ? parse(source, ['jsx', 'typescript'])
        : source;

    let moduleName: string | null = null;

    traverse(ast, {
        ImportDeclaration: path => {
            for (const specifier of path.node.specifiers) {
                if (matches(getImportedName(specifier), importName)) {
                    moduleName = path.node.source.value;

                    return path.stop();
                }
            }

            return path.skip();
        },
    });

    return moduleName;
}

function getImportedName(specifier: t.ImportDeclaration['specifiers'][number]): string {
    if (t.isImportDefaultSpecifier(specifier)) {
        return 'default';
    }

    if (t.isImportNamespaceSpecifier(specifier)) {
        return '*';
    }

    return t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value;
}

function matches(value: string, matcher: string | RegExp): boolean {
    return typeof matcher === 'string' ? value === matcher : matcher.test(value);
}
