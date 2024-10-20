import {namedTypes as Ast, builders as builder} from 'ast-types';
import {Codemod, ResultCode} from '@/application/project/sdk/code/codemod';

export type AppComponentOptions = {
    typescript?: boolean,
};

export class CreateAppComponent implements Codemod<Ast.File, AppComponentOptions> {
    public apply(input: Ast.File, options: AppComponentOptions = {}): Promise<ResultCode<Ast.File>> {
        const isTypescript = options.typescript ?? false;
        const {body} = input.program;

        body.splice(0, body.length);

        if (isTypescript) {
            body.push(
                CreateAppComponent.import('type', 'ReactElement', 'react'),
                CreateAppComponent.import('type', 'AppProps', 'next/app'),
            );
        }

        body.push(CreateAppComponent.import('value', 'CroctProvider', '@croct/plug-next/CroctProvider'));

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
                                typeName: builder.identifier('ReactElement'),
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
