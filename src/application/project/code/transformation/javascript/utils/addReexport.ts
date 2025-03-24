import * as t from '@babel/types';
import {traverse} from '@babel/core';

export type ExportDeclaration = {
    type: 'value' | 'type',
    moduleName: string,
    importName?: string,
    exportName?: string,
};

type DeclarationMatch = {
    declaration: t.ExportNamedDeclaration,
    specifier?: t.ExportSpecifier,
};

export function addReexport(ast: t.File, target: ExportDeclaration): boolean {
    const declarations: DeclarationMatch[] = [];

    let matched = false;
    let modified = false;

    traverse(ast, {
        // export * from 'something'
        // export type * from 'something'
        ExportAllDeclaration: path => {
            const {node} = path;

            if (node.source.value !== target.moduleName) {
                return path.skip();
            }

            const exportKind = node.exportKind ?? 'value';

            if (target.exportName === undefined && target.importName === undefined) {
                // Exporting everything from the module
                if (exportKind === 'value' || (exportKind === 'type' && target.type === 'type')) {
                    matched = true;

                    return path.stop();
                }

                if (exportKind === 'type' && target.type === 'value') {
                    node.exportKind = 'value';

                    matched = true;
                    modified = true;

                    return path.stop();
                }
            } else if (
                (target.exportName === undefined || target.exportName === target.importName)
                && (exportKind === 'value' || (exportKind === 'type' && target.type === 'type'))
            ) {
                matched = true;

                return path.stop();
            }

            return path.skip();
        },
        // import {something} from 'something'
        // import {something as somethingElse} from 'something'
        ExportNamedDeclaration: path => {
            const {node} = path;
            const source = node.source ?? null;

            if (source === null || source.value !== target.moduleName) {
                return path.skip();
            }

            declarations.push({declaration: node});

            const exportKind = node.exportKind ?? 'value';

            for (const specifier of node.specifiers) {
                if (t.isExportNamespaceSpecifier(specifier)) {
                    if (target.importName === undefined && specifier.exported.name === target.exportName) {
                        matched = true;

                        if (target.type === 'value' && exportKind === 'type') {
                            node.exportKind = 'value';
                            modified = true;
                        }

                        return path.stop();
                    }
                }

                if (
                    target.importName === undefined
                    || !t.isExportSpecifier(specifier)
                    || getIdentifierName(specifier.local) !== target.importName
                    || (target.exportName !== undefined && getIdentifierName(specifier.exported) !== target.exportName)
                ) {
                    continue;
                }

                const specifierExportKind = specifier.exportKind ?? 'value';

                if (
                    exportKind === target.type
                    || (exportKind === 'value' && (
                        specifierExportKind === 'value'
                        || specifier.exportKind === target.type
                    ))
                ) {
                    matched = true;

                    return path.stop();
                }

                // Add to the beginning since to ensure it is processed first
                // as it is the most specific match
                declarations.unshift({
                    declaration: node,
                    specifier: specifier,
                });
            }

            return path.skip();
        },
    });

    if (matched) {
        return modified;
    }

    const {body} = ast.program;

    if (target.importName === undefined) {
        if (target.exportName === undefined) {
            // remove all named exports from the module
            for (const match of declarations) {
                const {declaration} = match;
                const declarationExportKind = declaration.exportKind ?? 'value';

                const specifiers = declaration.specifiers.filter(
                    // Remove all specifiers not aliased to the same name
                    specifier => (
                        !t.isExportSpecifier(specifier)
                        || specifier.local.name !== getIdentifierName(specifier.exported)
                        || (target.type === 'type' && (
                            declarationExportKind !== 'type' && specifier.exportKind !== 'type'
                        ))
                    ),
                );

                if (specifiers.length === 0) {
                    body.splice(body.indexOf(declaration), 1);
                } else {
                    declaration.specifiers = specifiers;
                }
            }
        }

        const declaration = target.exportName === undefined
            // export * from 'module'
            ? t.exportAllDeclaration(t.stringLiteral(target.moduleName))
            // export * as name from 'module'
            : t.exportNamedDeclaration(
                null,
                [t.exportNamespaceSpecifier(t.identifier(target.exportName))],
                t.stringLiteral(target.moduleName),
            );

        if (target.type === 'type') {
            declaration.exportKind = 'type';
        }

        body.push(declaration);

        return true;
    }

    for (const match of declarations) {
        const {declaration} = match;

        if (declaration.exportKind === 'type' && target.type === 'value') {
            // if the declaration is a type export, convert it to a value export
            // and flip all export specifiers to type exports but the target one
            declaration.exportKind = 'value';

            for (const otherSpecifier of declaration.specifiers) {
                if (t.isExportSpecifier(otherSpecifier) && otherSpecifier !== match.specifier) {
                    otherSpecifier.exportKind = 'type';
                }
            }

            if (match.specifier === undefined) {
                declaration.specifiers.push(
                    t.exportSpecifier(
                        t.identifier(target.importName),
                        t.identifier(target.exportName ?? target.importName),
                    ),
                );
            }

            return true;
        }
    }

    // No specifier was found, add a new specifier to the first declaration
    for (const {declaration} of declarations) {
        const exportKind = declaration.exportKind ?? 'value';

        if (exportKind === 'value' || exportKind === target.type) {
            // export {name} from 'module'
            const specifier = t.exportSpecifier(
                t.identifier(target.importName),
                t.identifier(target.exportName ?? target.importName),
            );

            if (exportKind !== target.type) {
                specifier.exportKind = 'type';
            }

            declaration.specifiers.push(specifier);

            return true;
        }
    }

    const declaration = t.exportNamedDeclaration(
        null,
        [t.exportSpecifier(t.identifier(target.importName), t.identifier(target.exportName ?? target.importName))],
        t.stringLiteral(target.moduleName),
    );

    if (target.type === 'type') {
        declaration.exportKind = 'type';
    }

    body.push(declaration);

    return true;
}

function getIdentifierName(value: t.Identifier | t.StringLiteral): string {
    return t.isIdentifier(value) ? value.name : value.value;
}
