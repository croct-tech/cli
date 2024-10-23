import * as t from '@babel/types';
import {Codemod, ResultCode} from '@/application/project/sdk/code/codemod';
import {addImport} from '@/application/project/sdk/code/javascript/addImport';

export type ComponentOptions = {
    typescript?: boolean,
};

export type ComponentConfiguration = {
    provider: {
        component: string,
        module: string,
    },
};

export class CreateLayoutComponent implements Codemod<t.File, ComponentOptions> {
    private configuration: ComponentConfiguration;

    public constructor(configuration: ComponentConfiguration) {
        this.configuration = configuration;
    }

    public apply(input: t.File, options: ComponentOptions = {}): Promise<ResultCode<t.File>> {
        const isTypescript = options.typescript ?? false;
        const {body} = input.program;

        const providerImport = addImport(input, {
            type: 'value',
            moduleName: this.configuration.provider.module,
            importName: this.configuration.provider.component,
        });

        const propsImport = isTypescript
            ? addImport(input, {
                type: 'type',
                moduleName: 'react',
                importName: 'PropsWithChildren',
            })
            : null;

        const reactNodeImport = isTypescript
            ? addImport(input, {
                type: 'type',
                moduleName: 'react',
                importName: 'ReactNode',
            })
            : null;

        const props = t.objectPattern([
            t.objectProperty(
                t.identifier('children'),
                t.identifier('children'),
            ),
        ]);

        if (propsImport !== null) {
            props.typeAnnotation = t.tsTypeAnnotation(
                t.tsTypeReference(t.identifier(propsImport.localName)),
            );
        }

        const functionDeclaration = t.functionDeclaration(
            t.identifier('RootLayout'),
            [props],
            t.blockStatement([
                t.returnStatement(
                    t.parenthesizedExpression(
                        t.jsxElement(
                            t.jsxOpeningElement(
                                t.jsxIdentifier('html'),
                                [t.jsxAttribute(t.jsxIdentifier('lang'), t.stringLiteral('en'))],
                            ),
                            t.jsxClosingElement(t.jsxIdentifier('html')),
                            [
                                t.jsxText('\n'),
                                t.jsxElement(
                                    t.jsxOpeningElement(t.jsxIdentifier('body'), []),
                                    t.jsxClosingElement(t.jsxIdentifier('body')),
                                    [
                                        t.jsxText('\n'),
                                        t.jsxElement(
                                            t.jsxOpeningElement(t.jsxIdentifier(providerImport.localName), []),
                                            t.jsxClosingElement(t.jsxIdentifier(providerImport.localName)),
                                            [
                                                t.jsxText('\n'),
                                                t.jsxExpressionContainer(t.identifier('children')),
                                                t.jsxText('\n'),
                                            ],
                                        ),
                                        t.jsxText('\n'),
                                    ],
                                ),
                                t.jsxText('\n'),
                            ],
                        ),
                    ),
                ),
            ]),
        );

        if (reactNodeImport !== null) {
            functionDeclaration.returnType = t.tsTypeAnnotation(
                t.tsTypeReference(t.identifier(reactNodeImport.localName)),
            );
        }

        body.push(t.exportDefaultDeclaration(functionDeclaration));

        return Promise.resolve({
            modified: true,
            result: input,
        });
    }
}
