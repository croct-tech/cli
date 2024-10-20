import type {namedTypes as Ast} from 'ast-types/gen/namedTypes';
import {parse as babelParse} from '@babel/parser';
import {parse as recastParse} from 'recast';
import {MalformedCodeError} from '@/application/project/sdk/code/codemod';

export type Language = 'jsx' | 'typescript';

export function parse(source: string, languages: Language[]): Ast.Node {
    try {
        return recastParse(source, {
            parser: {
                parse: (input: string) => babelParse(input, {
                    sourceType: 'module',
                    tokens: true,
                    plugins: languages,
                }),
            },
        });
    } catch {
        throw new MalformedCodeError('The source code contains syntax errors.');
    }
}
