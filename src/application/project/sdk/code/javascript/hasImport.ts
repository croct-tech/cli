import {visit} from 'recast';
import {namedTypes as Ast} from 'ast-types/gen/namedTypes';
import {parse} from '@/application/project/sdk/code/parser';

export type ImportMatcher = {
    moduleName: string|RegExp,
    importName?: string|RegExp,
};

export function hasImport(source: string, matcher: ImportMatcher): boolean {
    const ast = parse(source, ['jsx', 'typescript']);

    let found = false;

    visit(ast, {
        // export {something} from 'something'
        // export {something as somethingElse} from 'something'
        visitExportNamedDeclaration: function accept(path) {
            const {node} = path;

            if (!Ast.StringLiteral.check(node.source) || !matches(node.source.value, matcher.moduleName)) {
                return false;
            }

            if (matcher.importName === undefined) {
                found = true;

                return false;
            }

            for (const specifier of node.specifiers ?? []) {
                if (
                    Ast.ExportSpecifier.check(specifier)
                    && Ast.Identifier.check(specifier.local)
                    && matches(specifier.local.name, matcher.importName)
                ) {
                    found = true;

                    return false;
                }
            }

            return false;
        },
        // import {something} from 'something'
        // import {something as somethingElse} from 'something'
        visitImportDeclaration: function accept(path) {
            const {node} = path;

            if (!Ast.StringLiteral.check(node.source) || !matches(node.source.value, matcher.moduleName)) {
                return false;
            }

            if (matcher.importName === undefined) {
                found = true;

                return false;
            }

            for (const specifier of node.specifiers ?? []) {
                if (
                    Ast.ImportSpecifier.check(specifier)
                    && Ast.Identifier.check(specifier.imported)
                    && matches(specifier.imported.name, matcher.importName)
                ) {
                    found = true;

                    return false;
                }
            }

            return false;
        },
    });

    return found;
}

function matches(value: string, matcher: string|RegExp): boolean {
    if (typeof matcher === 'string') {
        return value === matcher;
    }

    return matcher.test(value);
}
