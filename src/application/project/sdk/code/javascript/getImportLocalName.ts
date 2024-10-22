import {visit} from 'recast';
import {namedTypes as Ast} from 'ast-types/gen/namedTypes';
import {parse} from '@/application/project/sdk/code/parser';

export type ImportMatcher = {
    moduleName: string | RegExp,
    importName: string | RegExp,
};

export function getImportLocalName(source: string | Ast.Node, matcher: ImportMatcher): string | null {
    const ast = typeof source === 'string'
        ? parse(source, ['jsx', 'typescript'])
        : source;

    let localName: string | null = null;

    visit(ast, {
        // import {something} from 'something'
        // import {something as somethingElse} from 'something'
        visitImportDeclaration: function accept(path) {
            const {node} = path;

            if (!Ast.StringLiteral.check(node.source) || !matches(node.source.value, matcher.moduleName)) {
                return false;
            }

            for (const specifier of node.specifiers ?? []) {
                if (Ast.ImportDefaultSpecifier.check(specifier)) {
                    if (matches('default', matcher.importName) && Ast.Identifier.check(specifier.local)) {
                        localName = specifier.local.name;
                    }

                    continue;
                }

                if (
                    Ast.ImportSpecifier.check(specifier)
                    && Ast.Identifier.check(specifier.imported)
                    && matches(specifier.imported.name, matcher.importName)
                ) {
                    localName = Ast.Identifier.check(specifier.local)
                        ? specifier.local.name
                        : specifier.imported.name;

                    return false;
                }
            }

            return false;
        },
    });

    return localName;
}

function matches(value: string, matcher: string | RegExp): boolean {
    if (typeof matcher === 'string') {
        return value === matcher;
    }

    return matcher.test(value);
}
