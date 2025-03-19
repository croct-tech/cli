import * as t from '@babel/types';
import traverse from '@babel/traverse';
import {parse} from '@/application/project/code/transformation/javascript/utils/parse';

export function getExportedNames(source: string | t.File): string[] {
    const ast = typeof source === 'string'
        ? parse(source, ['jsx', 'typescript'])
        : source;

    const names: string[] = [];

    traverse(ast, {
        ExportDeclaration: path => {
            const {node} = path;

            if (t.isExportNamedDeclaration(node)) {
                if (node.specifiers.length > 0) {
                    for (const specifier of node.specifiers) {
                        if (t.isExportSpecifier(specifier)) {
                            if (!t.isIdentifier(specifier.exported) || specifier.exported.name !== 'default') {
                                names.push(
                                    t.isIdentifier(specifier.exported)
                                        ? specifier.exported.name
                                        : specifier.exported.value,
                                );
                            }
                        } else if (t.isExportNamespaceSpecifier(specifier)) {
                            if (t.isIdentifier(specifier.exported)) {
                                names.push(specifier.exported.name);
                            }
                        }
                    }
                } else if (t.isVariableDeclaration(node.declaration)) {
                    for (const declaration of node.declaration.declarations) {
                        if (t.isVariableDeclarator(declaration) && t.isIdentifier(declaration.id)) {
                            names.push(declaration.id.name);
                        }
                    }
                } else if (
                    typeof node.declaration === 'object'
                    && node.declaration !== null
                    && 'id' in node.declaration
                    && t.isIdentifier(node.declaration.id)
                ) {
                    names.push(node.declaration.id.name);
                }
            }

            return path.skip();
        },
    });

    return names;
}
