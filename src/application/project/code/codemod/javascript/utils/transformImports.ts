import * as t from '@babel/types';
import traverse from '@babel/traverse';

export type ImportDeclaration = {
    names: string[],
    source: string,
};

export type ImportTransformer = (declaration: ImportDeclaration) => Promise<string|void>|string|void;

export async function transformImports(ast: t.File, transformer: ImportTransformer): Promise<boolean> {
    const promises: Array<Promise<boolean>> = [];

    traverse(ast, {
        ImportDeclaration: path => {
            const {node} = path;

            const promise = Promise.resolve(transformer(getDeclaration(node)));

            if (promise !== undefined) {
                promises.push(
                    promise.then(source => {
                        if (typeof source === 'string' && node.source.value !== source) {
                            node.source.value = source;

                            return true;
                        }

                        return false;
                    }),
                );
            }

            return path.skip();
        },
    });

    return (await Promise.all(promises)).some(changed => changed);
}

function getDeclaration(node: t.ImportDeclaration): ImportDeclaration {
    const declaration: ImportDeclaration = {
        names: [],
        source: node.source.value,
    };

    for (const specifier of node.specifiers) {
        if (t.isImportSpecifier(specifier)) {
            declaration.names.push(
                t.isIdentifier(specifier.imported)
                    ? specifier.imported.name
                    : specifier.imported.value,
            );
        }
    }

    return declaration;
}
