import {readFile, writeFile} from 'fs/promises';
import {Codemod, CodemodError, CodemodOptions, ResultCode} from '@/application/project/sdk/code/codemod';
import {formatCause} from '@/application/error';

export class TransformFile<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly codemod: Codemod<string, O>;

    public constructor(codemod: Codemod<string, O>) {
        this.codemod = codemod;
    }

    public async apply(input: string, options?: O): Promise<ResultCode<string>> {
        let source = '';

        try {
            source = await readFile(input, 'utf-8');
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw new CodemodError(`Failed to read file: ${formatCause(error)}`);
            }
        }

        const result = await this.codemod.apply(source, options);

        if (result.modified) {
            try {
                await writeFile(input, result.result, {encoding: 'utf-8', flag: 'w'});
            } catch (error) {
                throw new CodemodError(`Failed to write file: ${formatCause(error)}`);
            }
        }

        return result;
    }
}
