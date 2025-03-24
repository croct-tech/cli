import {File} from '@babel/types';
import {Codemod, ResultCode} from '@/application/project/code/transformation/codemod';
import {ImportTransformer} from '@/application/project/code/transformation/globImportCodemod';
import {transformImports} from '@/application/project/code/transformation/javascript/utils/transformImports';

export type JavaScriptImportOptions = {
    transformer: ImportTransformer,
};

export class JavaScriptImportCodemod implements Codemod<File, JavaScriptImportOptions> {
    public async apply(file: File, options: JavaScriptImportOptions): Promise<ResultCode<File>> {
        const modified = await transformImports(file, options.transformer);

        return {
            result: file,
            modified: modified,
        };
    }
}
