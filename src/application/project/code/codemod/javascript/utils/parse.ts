import {parse as babelParse, ParserOptions} from '@babel/parser';
import {File} from '@babel/types';
import {MalformedCodeError} from '@/application/project/code/codemod/codemod';

export type Language = 'jsx' | 'typescript';

export function parse(source: string, languages: Language[], options?: ParserOptions): File {
    try {
        return babelParse(source, {
            ...options,
            sourceType: 'module',
            plugins: [...languages, ...(options?.plugins ?? [])],
        });
    } catch {
        throw new MalformedCodeError('The source code contains syntax errors.');
    }
}
