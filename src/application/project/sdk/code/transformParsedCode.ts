import type {namedTypes as Ast} from 'ast-types';
import {parse, print} from 'recast';
import {parse as babelParse} from '@babel/parser';
import {CodeTransformer, TransformedCode} from '@/application/project/sdk/code/transformation';

export class TransformParsedCode implements CodeTransformer<string> {
    private readonly transformers: Array<CodeTransformer<Ast.Node>>;

    public constructor(...transformers: Array<CodeTransformer<Ast.Node>>) {
        this.transformers = transformers;
    }

    public transform(input: string): TransformedCode<string> {
        if (this.transformers.length === 0) {
            return {
                modified: false,
                result: input,
            };
        }

        const ast = parse(input, {
            parser: {
                parse: (source: string) => babelParse(source, {
                    sourceType: 'module',
                    tokens: true,
                    plugins: ['jsx', 'typescript'],
                }),
            },
        });

        const result = this.transformers.reduce<TransformedCode<Ast.Node>>(
            (next, transformer) => {
                const transformation = transformer.transform(next.result);

                return {
                    modified: transformation.modified || next.modified,
                    result: transformation.result,
                };
            },
            {
                modified: false,
                result: ast,
            },
        );

        if (!result.modified) {
            return {
                modified: false,
                result: input,
            };
        }

        return {
            modified: true,
            result: print(result.result).code,
        };
    }
}
