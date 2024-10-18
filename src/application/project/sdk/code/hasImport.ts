import {parse} from '@babel/parser';
import {visit} from 'recast';
import {namedTypes as Ast} from 'ast-types/gen/namedTypes';

export type ImportMatcher = {
    moduleName: string|RegExp,
    importName?: string|RegExp,
};

export function hasImport(source: string, matcher: ImportMatcher): boolean {
    let ast: Ast.Node;

    try {
        ast = parse(source, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });
    } catch {
        return false;
    }

    let found = false;

    visit(ast, {
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
