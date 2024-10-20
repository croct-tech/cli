import {namedTypes as Ast} from 'ast-types/gen/namedTypes';
import {builders as builder} from 'ast-types';
import {Codemod, ResultCode} from '@/application/project/sdk/code/codemod';

export type LayoutComponentOptions = {
    typescript?: boolean,
};

export class CreateLayoutComponent implements Codemod<Ast.File, LayoutComponentOptions> {
    public apply(input: Ast.File, options: LayoutComponentOptions = {}): Promise<ResultCode<Ast.File>> {
        const isTypescript = options.typescript ?? false;
        const {body} = input.program;

        body.splice(0, body.length);

        if (isTypescript) {
            body.push(
                builder.importDeclaration.from({
                    importKind: 'type',
                    specifiers: [
                        builder.importSpecifier.from({
                            imported: builder.identifier('ReactNode'),
                        }),
                        builder.importSpecifier.from({
                            imported: builder.identifier('PropsWithChildren'),
                        }),
                    ],
                    source: builder.literal('react'),
                }),
            );
        }

        body.push(
            builder.importDeclaration.from({
                importKind: 'value',
                specifiers: [
                    builder.importSpecifier.from({
                        imported: builder.identifier('CroctProvider'),
                    }),
                ],
                source: builder.literal('@croct/plug-next/CroctProvider'),
            }),
        );

        body.push(
            builder.exportDefaultDeclaration.from({
                declaration: builder.functionDeclaration.from({
                    id: builder.identifier('RootLayout'),
                    params: [
                        builder.objectPattern.from({
                            properties: [
                                builder.property.from({
                                    kind: 'init',
                                    key: builder.identifier('children'),
                                    value: builder.identifier('children'),
                                }),
                            ],
                            typeAnnotation: isTypescript
                                ? builder.tsTypeAnnotation.from({
                                    typeAnnotation: builder.tsTypeReference.from({
                                        typeName: builder.identifier('PropsWithChildren'),
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
                                    name: builder.jsxIdentifier('html'),
                                    attributes: [
                                        builder.jsxAttribute.from({
                                            name: builder.jsxIdentifier('lang'),
                                            value: builder.literal('en'),
                                        }),
                                    ],
                                }),
                                closingElement: builder.jsxClosingElement.from({
                                    name: builder.jsxIdentifier('html'),
                                }),
                                children: [
                                    builder.jsxText('\n'),
                                    builder.jsxElement.from({
                                        openingElement: builder.jsxOpeningElement.from({
                                            name: builder.jsxIdentifier('body'),
                                        }),
                                        closingElement: builder.jsxClosingElement.from({
                                            name: builder.jsxIdentifier('body'),
                                        }),
                                        children: [
                                            builder.jsxText('\n'),
                                            builder.jsxElement.from({
                                                openingElement: builder.jsxOpeningElement.from({
                                                    name: builder.jsxIdentifier('CroctProvider'),
                                                }),
                                                closingElement: builder.jsxClosingElement.from({
                                                    name: builder.jsxIdentifier('CroctProvider'),
                                                }),
                                                children: [
                                                    builder.jsxText('\n'),
                                                    builder.jsxExpressionContainer.from({
                                                        expression: builder.identifier('children'),
                                                    }),
                                                    builder.jsxText('\n'),
                                                ],
                                            }),
                                            builder.jsxText('\n'),
                                        ],
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
}
