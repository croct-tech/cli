import {parse as babelParse} from '@babel/parser';
import {File} from '@babel/types';
import {MalformedCodeError} from '@/application/project/code/codemod/codemod';

export type Language = 'jsx' | 'typescript';

export function parse(source: string, languages: Language[]): File {
    try {
        return babelParse(source, {
            sourceType: 'module',
            plugins: languages,
        });
    } catch {
        throw new MalformedCodeError('The source code contains syntax errors.');
    }
}
