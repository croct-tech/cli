import {namedTypes as AST} from 'ast-types';
import {parse, print} from 'recast';
import {parse as babelParse} from '@babel/parser';

export type TransformedAst = {
    modified: boolean,
    ast: AST.File,
};

export interface Transformer {
    transform(ast: AST.File): TransformedAst;
}

export type TransformedCode = {
    modified: boolean,
    code: string,
};

export function transform(source: string, ...transformers: Transformer[]): TransformedCode {
    if (transformers.length === 0) {
        return {
            modified: false,
            code: source,
        };
    }

    const ast = parse(source, {
        parser: {
            parse: (input: string) => babelParse(input, {
                sourceType: 'module',
                tokens: true,
                plugins: ['jsx', 'typescript'],
            }),
        },
    });

    const result = transformers.reduce<TransformedAst>(
        (next, transformer) => {
            const transformation = transformer.transform(next.ast);

            return {
                modified: transformation.modified || next.modified,
                ast: transformation.ast,
            };
        },
        {
            modified: false,
            ast: ast,
        },
    );

    if (!result.modified) {
        return {
            modified: false,
            code: source,
        };
    }

    return {
        modified: true,
        code: print(result.ast).code,
    };
}
