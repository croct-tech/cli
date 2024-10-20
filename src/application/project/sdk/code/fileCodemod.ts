import {readFile, writeFile} from 'fs/promises';
import {Codemod, CodemodError, ResultCode} from '@/application/project/sdk/code/transformation';
import {formatCause} from '@/application/error';

export class FileCodemod implements Codemod<string> {
    private readonly codemod: Codemod<string>;

    public constructor(codemod: Codemod<string>) {
        this.codemod = codemod;
    }

    public async apply(input: string): Promise<ResultCode<string>> {
        let source = '';

        try {
            source = await readFile(input, 'utf-8');
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw new CodemodError(`Failed to read file: ${formatCause(error)}`);
            }
        }

        const result = await this.codemod.apply(source);

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
