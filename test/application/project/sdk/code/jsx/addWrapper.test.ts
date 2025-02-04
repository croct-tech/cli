import {resolve} from 'path';
import {addComment, File} from '@babel/types';
import {AddWrapper, WrapperConfiguration} from '@/application/project/code/codemod/jsx/addWrapper';
import {loadFixtures} from '../fixtures';
import {ParseCode} from '@/application/project/code/codemod/parseCode';
import {Codemod} from '@/application/project/code/codemod/codemod';

describe('AddWrapper', () => {
    const defaultOptions: WrapperConfiguration = {
        wrapper: {
            module: '@croct/plug-react',
            component: 'CroctProvider',
        },
    };

    const scenarios = loadFixtures<WrapperConfiguration>(
        resolve(__dirname, '../fixtures/jsx-wrapper'),
        defaultOptions,
        // Custom options
        {
            'targetComponent.tsx': {
                targets: {
                    component: 'Component',
                },
            },
            'targetChildren.tsx': {
                targets: {
                    variable: 'children',
                },
            },
            'targetChildrenAliasedImport.tsx': {
                targets: {
                    variable: 'children',
                },
            },
            'namedExportArrowFunctionWithBody.tsx': {
                fallbackToNamedExports: true,
            },
            'namedExportArrowFunction.tsx': {
                fallbackToNamedExports: true,
            },
            'namedExportFunctionDeclaration.tsx': {
                fallbackToNamedExports: true,
            },
            'namedExportFunctionExpression.tsx': {
                fallbackToNamedExports: true,
            },
            'namedSpecifiedExport.tsx': {
                fallbackToNamedExports: true,
            },
            'namedExportUnrelated.tsx': {
                fallbackToNamedExports: true,
            },
            'defaultExportFunctionReference.tsx': {
                targets: {
                    variable: 'children',
                },
            },
            'defaultExportArrowFunctionReference.tsx': {
                targets: {
                    variable: 'children',
                },
            },
            'defaultExportFunctionExpressionReference.tsx': {
                targets: {
                    variable: 'children',
                },
            },
            'providerObjectMemberProp.tsx': {
                wrapper: {
                    ...defaultOptions.wrapper,
                    props: {
                        appId: {
                            type: 'reference',
                            path: ['process', 'env', 'REACT_APP_CROCT_APP_ID'],
                        },
                    },
                },
            },
            'providerVariableProp.tsx': {
                wrapper: {
                    ...defaultOptions.wrapper,
                    props: {
                        appId: {
                            type: 'reference',
                            path: ['CROCT_APP_ID'],
                        },
                    },
                },
            },
            'providerTernaryProp.tsx': {
                wrapper: {
                    ...defaultOptions.wrapper,
                    props: {
                        booleanProp: {
                            type: 'ternary',
                            condition: {
                                operator: '===',
                                left: {
                                    type: 'reference',
                                    path: ['process', 'env', 'NODE_ENV'],
                                },
                                right: {
                                    type: 'literal',
                                    value: 'production',
                                },
                            },
                            consequent: {
                                type: 'reference',
                                path: ['process', 'env', 'PRODUCTION_CROCT_APP_ID'],
                            },
                            alternate: {
                                type: 'reference',
                                path: ['process', 'env', 'STAGING_CROCT_APP_ID'],
                            },
                        },
                    },
                },
            },
            'providerLiteralProp.tsx': {
                wrapper: {
                    ...defaultOptions.wrapper,
                    props: {
                        booleanProp: {
                            type: 'literal',
                            value: true,
                        },
                        numberProp: {
                            type: 'literal',
                            value: 42,
                        },
                        stringProp: {
                            type: 'literal',
                            value: 'value',
                        },
                        nullProp: {
                            type: 'literal',
                            value: null,
                        },
                    },
                },
            },
        },
    );

    it.each(scenarios)('should correctly transform $name', async ({name, fixture, options}) => {
        const transformer = new ParseCode({
            languages: ['typescript', 'jsx'],
            codemod: new AddWrapper(options),
        });

        const output = await transformer.apply(fixture);

        expect(output.result).toMatchSnapshot(name);
    });

    it('should call the fallback codemod when the component is not found', async () => {
        const options = {test: true};

        const codemod: Codemod<File, typeof options> = {
            apply: jest.fn((input: File) => {
                const {body} = input.program;

                addComment(body[0], 'leading', ' This is a comment');

                return Promise.resolve({
                    modified: true,
                    result: input,
                });
            }),
        };

        const transformer = new ParseCode({
            languages: ['typescript', 'jsx'],
            codemod: new AddWrapper({
                ...defaultOptions,
                fallbackCodemod: codemod,
            }),
        });

        const {result} = await transformer.apply('export {Component} from \'./component\';', options);

        expect(codemod.apply).toHaveBeenCalledWith(expect.any(Object), options);

        expect(result).toEqual(
            '/* This is a comment*/\n'
            + 'export { Component } from \'./component\';',
        );
    });

    it('should not call the fallback codemod when the wrapper is already present', async () => {
        const codemod: Codemod<File> = {
            apply: jest.fn(),
        };

        const transformer = new ParseCode({
            languages: ['typescript', 'jsx'],
            codemod: new AddWrapper<{test: boolean}>({
                ...defaultOptions,
                fallbackCodemod: codemod,
            }),
        });

        const input = [
            "import {CroctProvider} from '@croct/plug-react';",
            'export default function Component() {',
            '  return <CroctProvider/>',
            '}',
        ].join('\n');

        const {result} = await transformer.apply(input);

        expect(codemod.apply).not.toHaveBeenCalled();

        expect(result).toEqual(input);
    });
});
