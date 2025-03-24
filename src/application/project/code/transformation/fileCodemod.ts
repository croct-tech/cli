import {Codemod, CodemodError, CodemodOptions, ResultCode} from '@/application/project/code/transformation/codemod';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration<O extends CodemodOptions> = {
    fileSystem: FileSystem,
    codemod: Codemod<string, O>,
};

export class FileCodemod<O extends CodemodOptions> implements Codemod<string, O> {
    private readonly fileSystem: FileSystem;

    private readonly codemod: Codemod<string, O>;

    public constructor({fileSystem, codemod}: Configuration<O>) {
        this.fileSystem = fileSystem;
        this.codemod = codemod;
    }

    public async apply(input: string, options: O): Promise<ResultCode<string>> {
        let source = '';

        if (await this.fileSystem.exists(input)) {
            try {
                source = await this.fileSystem.readTextFile(input);
            } catch (error) {
                throw new CodemodError('Failed to read file.', {
                    cause: error,
                    details: [`File: file://${input.replace(/\\/g, '/')}`],
                });
            }
        }

        const result = await this.codemod.apply(source, options);

        if (result.modified) {
            try {
                await this.fileSystem.writeTextFile(input, result.result, {
                    overwrite: true,
                });
            } catch (error) {
                throw new CodemodError('Failed to write file', {
                    cause: error,
                    details: [`File: file://${input.replace(/\\/g, '/')}`],
                });
            }
        }

        return {
            modified: result.modified,
            result: input,
        };
    }
}
