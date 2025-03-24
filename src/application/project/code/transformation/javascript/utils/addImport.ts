import * as t from '@babel/types';
import {traverse} from '@babel/core';

export type ImportDeclaration = {
    type: 'value' | 'type',
    moduleName: string,
    importName: string,
    localName?: string,
};

export type ImportResult = {
    modified: boolean,
    localName: string,
};

type DeclarationMatch = {
    declaration: t.ImportDeclaration,
    specifier?: never,
    localName?: never,
};

type ImportMatch = Pick<DeclarationMatch, 'declaration'> & {
    specifier: t.ImportSpecifier,
    localName: string,
};

export function addImport(ast: t.File, target: ImportDeclaration): ImportResult {
    const declarations: Array<ImportMatch|DeclarationMatch> = [];

    let importMatch: string | null = null;

    traverse(ast, {
        // import {something} from 'something'
        // import {something as somethingElse} from 'something'
        ImportDeclaration: path => {
            const {node} = path;

            if (node.source.value !== target.moduleName) {
                return path.skip();
            }

            declarations.push({declaration: node});

            const importKind = node.importKind ?? 'value';

            for (const specifier of node.specifiers) {
                if (!t.isImportSpecifier(specifier) || getIdentifierName(specifier.imported) !== target.importName) {
                    continue;
                }

                if (
                    (importKind === 'value' && (specifier.importKind === null || specifier.importKind === target.type))
                    || (importKind === 'type' && target.type === 'type')
                ) {
                    importMatch = specifier.local.name;

                    return path.stop();
                }

                declarations.unshift({
                    declaration: node,
                    specifier: specifier,
                    localName: specifier.local.name,
                });
            }

            return path.skip();
        },
    });

    if (importMatch !== null) {
        return {
            modified: false,
            localName: importMatch,
        };
    }

    if (declarations.length > 0) {
        for (const match of declarations) {
            const {declaration} = match;

            if (declaration.importKind === 'type' && target.type === 'value') {
                // if the declaration is a type import, convert it to a value import
                // and flip all import specifiers to type imports but the target one
                declaration.importKind = 'value';

                for (const otherSpecifier of declaration.specifiers) {
                    if (t.isImportSpecifier(otherSpecifier) && otherSpecifier !== match.specifier) {
                        otherSpecifier.importKind = 'type';
                    }
                }

                if (match.localName === undefined) {
                    const specifier = t.importSpecifier(
                        t.identifier(target.localName ?? target.importName),
                        t.identifier(target.importName),
                    );

                    specifier.importKind = target.type;

                    declaration.specifiers.push(specifier);
                }

                return {
                    modified: true,
                    localName: match.localName ?? target.importName,
                };
            }

            if (match.specifier !== undefined && match.specifier.importKind === 'type' && target.type === 'value') {
                // if the target specifier is a type import but the import is a value import,
                // convert the target specifier to a value import and keep the others as type imports
                match.specifier.importKind = 'value';

                return {
                    modified: true,
                    localName: match.localName,
                };
            }
        }

        // No specifier was found, add a new specifier to the first declaration
        for (const {declaration} of declarations) {
            const importKind = declaration.importKind ?? 'value';

            if (importKind === 'value' || importKind === target.type) {
                const specifier = t.importSpecifier(
                    t.identifier(target.localName ?? target.importName),
                    t.identifier(target.importName),
                );

                if (importKind !== target.type) {
                    specifier.importKind = 'type';
                }

                declaration.specifiers.push(specifier);

                return {
                    modified: true,
                    localName: target.localName ?? target.importName,
                };
            }
        }
    }

    const declaration = t.importDeclaration(
        [
            t.importSpecifier(
                t.identifier(target.localName ?? target.importName),
                t.identifier(target.importName),
            ),
        ],
        t.stringLiteral(target.moduleName),
    );

    if (target.type === 'type') {
        declaration.importKind = 'type';
    }

    ast.program
        .body
        .unshift(declaration);

    return {
        modified: true,
        localName: target.localName ?? target.importName,
    };
}

function getIdentifierName(value: t.Identifier | t.StringLiteral): string {
    return t.isIdentifier(value) ? value.name : value.value;
}
