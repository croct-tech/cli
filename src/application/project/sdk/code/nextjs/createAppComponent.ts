import {namedTypes as Ast, builders as builder} from 'ast-types';
import {Codemod, ResultCode} from '@/application/project/sdk/code/codemod';
import {hasImport} from '@/application/project/sdk/code/javascript/hasImport';

export type AppComponentOptions = {
    typescript?: boolean,
};

export class CreateAppComponent implements Codemod<Ast.File, AppComponentOptions> {
    public apply(input: Ast.File, options: AppComponentOptions = {}): Promise<ResultCode<Ast.File>> {
        const isTypescript = options.typescript ?? false;
        const {body} = input.program;

        if (!CreateAppComponent.hasImport(input, '@croct/plug-next/CroctProvider', 'CroctProvider')) {
            body.unshift(CreateAppComponent.import('value', 'CroctProvider', '@croct/plug-next/CroctProvider'));
        }

        if (isTypescript) {
            if (!CreateAppComponent.hasImport(input, 'next/app', 'AppProps')) {
                body.unshift(CreateAppComponent.import('type', 'AppProps', 'next/app'));
            }

            if (!CreateAppComponent.hasImport(input, 'react', 'ReactNode')) {
                body.unshift(CreateAppComponent.import('type', 'ReactNode', 'react'));
            }
        }

        body.push(
            builder.exportDefaultDeclaration.from({
                declaration: builder.functionDeclaration.from({
                    id: builder.identifier('App'),
                    params: [
                        builder.objectPattern.from({
                            properties: [
                                builder.property.from({
                                    kind: 'init',
                                    key: builder.identifier('Component'),
                                    value: builder.identifier('Component'),
                                }),
                                builder.property.from({
                                    kind: 'init',
                                    key: builder.identifier('pageProps'),
                                    value: builder.identifier('pageProps'),
                                }),
                            ],
                            typeAnnotation: isTypescript
                                ? builder.tsTypeAnnotation.from({
                                    typeAnnotation: builder.tsTypeReference.from({
                                        typeName: builder.identifier('AppProps'),
                                    }),
                                })
                                : null,
                        }),
                    ],
                    returnType: isTypescript
                        ? builder.tsTypeAnnotation.from({
                            typeAnnotation: builder.tsTypeReference.from({
                                typeName: builder.identifier('ReactNode'),
                            }),
                        })
                        : null,
                    body: builder.blockStatement([
                        builder.returnStatement(
                            builder.jsxElement.from({
                                openingElement: builder.jsxOpeningElement.from({
                                    name: builder.jsxIdentifier('CroctProvider'),
                                    attributes: [],
                                }),
                                closingElement: builder.jsxClosingElement.from({
                                    name: builder.jsxIdentifier('CroctProvider'),
                                }),
                                children: [
                                    builder.jsxText('\n'),
                                    builder.jsxElement.from({
                                        openingElement: builder.jsxOpeningElement.from({
                                            name: builder.jsxIdentifier('Component'),
                                            attributes: [
                                                builder.jsxSpreadAttribute.from({
                                                    argument: builder.identifier('pageProps'),
                                                }),
                                            ],
                                        }),
                                        closingElement: builder.jsxClosingElement.from({
                                            name: builder.jsxIdentifier('Component'),
                                        }),
                                        children: [],
                                    }),
                                    builder.jsxText('\n'),
                                ],
                            }),
                        ),
                    ]),
                }),
            }),
        );

        return Promise.resolve({
            modified: true,
            result: input,
        });
    }

    private static hasImport(input: Ast.File, moduleName: string, importName: string): boolean {
        return hasImport(input, {
            moduleName: moduleName,
            importName: importName,
            localName: importName,
        });
    }

    private static import(type: 'value' | 'type', name: string, from: string): Ast.ImportDeclaration {
        return builder.importDeclaration.from({
            importKind: type,
            specifiers: [
                builder.importSpecifier.from({
                    imported: builder.identifier(name),
                }),
            ],
            source: builder.literal(from),
        });
    }
}
