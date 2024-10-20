import {resolve} from 'path';
import {AddWrapper, WrapperOptions} from '@/application/project/sdk/code/react/addWrapper';
import {loadFixtures} from '../fixtures';
import {ParseCode} from '@/application/project/sdk/code/parseCode';

describe('AddWrapper', () => {
    const defaultOptions: WrapperOptions = {
        wrapper: {
            module: '@croct/plug-react',
            component: 'CroctProvider',
        },
    };

    const scenarios = loadFixtures<WrapperOptions>(
        resolve(__dirname, '../fixtures/wrapper'),
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
            'namedExportArrowFunctionWithBody.tsx': {
                namedExportFallback: true,
            },
            'namedExportArrowFunction.tsx': {
                namedExportFallback: true,
            },
            'namedExportFunctionDeclaration.tsx': {
                namedExportFallback: true,
            },
            'namedExportFunctionExpression.tsx': {
                namedExportFallback: true,
            },
            'namedSpecifiedExport.tsx': {
                namedExportFallback: true,
            },
            'namedExportUnrelated.tsx': {
                namedExportFallback: true,
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
            'providerEnvProp.tsx': {
                wrapper: {
                    ...defaultOptions.wrapper,
                    props: {
                        appId: {
                            type: 'env',
                            name: 'REACT_APP_CROCT_APP_ID',
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
});
