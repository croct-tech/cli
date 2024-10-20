import type {namedTypes as Ast} from 'ast-types';
import {print} from 'recast';
import {Codemod, ResultCode} from '@/application/project/sdk/code/transformation';
import {parse} from '@/application/project/sdk/code/parser';

export class AstCodemod implements Codemod<string> {
    private readonly codemods: Array<Codemod<Ast.Node>>;

    public constructor(...transformers: Array<Codemod<Ast.Node>>) {
        this.codemods = transformers;
    }

    public apply(input: string): ResultCode<string> {
        if (this.codemods.length === 0) {
            return {
                modified: false,
                result: input,
            };
        }

        const ast = parse(input, ['jsx', 'typescript']);

        const result = this.codemods.reduce<ResultCode<Ast.Node>>(
            (next, transformer) => {
                const transformation = transformer.apply(next.result);

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
