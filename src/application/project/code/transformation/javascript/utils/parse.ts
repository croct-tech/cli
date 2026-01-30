import type {ParserOptions} from '@babel/parser';
import {parse as babelParse} from '@babel/parser';
import type {File} from '@babel/types';
import {MalformedCodeError} from '@/application/project/code/transformation/codemod';

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
