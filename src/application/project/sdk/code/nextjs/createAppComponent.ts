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

export class CreateAppComponent implements Codemod<t.File, ComponentOptions> {
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
            localName: this.configuration.provider.component,
        });

        const appPropsImport = isTypescript
            ? addImport(input, {
                type: 'type',
                moduleName: 'next/app',
                importName: 'AppProps',
                localName: 'AppProps',
            })
            : null;

        const reactNodeImport = isTypescript
            ? addImport(input, {
                type: 'type',
                moduleName: 'react',
                importName: 'ReactNode',
                localName: 'ReactNode',
            })
            : null;

        const props = t.objectPattern([
            t.objectProperty(
                t.identifier('Component'),
                t.identifier('Component'),
            ),
            t.objectProperty(
                t.identifier('pageProps'),
                t.identifier('pageProps'),
            ),
        ]);

        if (appPropsImport !== null) {
            props.typeAnnotation = t.tsTypeAnnotation(
                t.tsTypeReference(t.identifier(appPropsImport.localName)),
            );
        }

        const functionDeclaration = t.functionDeclaration(
            t.identifier('App'),
            [props],
            t.blockStatement([
                t.returnStatement(
                    t.parenthesizedExpression(
                        t.jsxElement(
                            t.jsxOpeningElement(t.jsxIdentifier(providerImport.localName), []),
                            t.jsxClosingElement(t.jsxIdentifier(providerImport.localName)),
                            [
                                t.jsxText('\n'),
                                t.jsxElement(
                                    t.jsxOpeningElement(
                                        t.jsxIdentifier('Component'),
                                        [t.jsxSpreadAttribute(t.identifier('pageProps'))],
                                    ),
                                    t.jsxClosingElement(t.jsxIdentifier('Component')),
                                    [],
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
