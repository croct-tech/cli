import {Codemod, CodemodError, CodemodOptions, ResultCode} from '@/application/project/sdk/code/codemod';
import {formatCause} from '@/application/error';
import {FileSystem} from '@/application/fileSystem/fileSystem';

export class TransformFile<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly fileSystem: FileSystem;

    private readonly codemod: Codemod<string, O>;

    public constructor(fileSystem: FileSystem, codemod: Codemod<string, O>) {
        this.fileSystem = fileSystem;
        this.codemod = codemod;
    }

    public async apply(input: string, options?: O): Promise<ResultCode<string>> {
        let source = '';

        try {
            source = await this.fileSystem.readFile(input);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw new CodemodError(`Failed to read file: ${formatCause(error)}`);
            }
        }

        const result = await this.codemod.apply(source, options);

        if (result.modified) {
            try {
                await this.fileSystem.writeFile(input, result.result, {
                    overwrite: true,
                });
            } catch (error) {
                throw new CodemodError(`Failed to write file: ${formatCause(error)}`);
            }
        }

        return result;
    }
}
