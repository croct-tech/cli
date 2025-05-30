import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {Input} from '@/application/cli/io/input';
import {ErrorReason} from '@/application/error';

export type WriteFileOptions = {
    path: string,
    content: string,
    overwrite?: boolean,
};

export type Configuration = {
    fileSystem: FileSystem,
    input?: Input,
};

export class WriteFileAction implements Action<WriteFileOptions> {
    private readonly fileSystem: FileSystem;

    private readonly input?: Input;

    public constructor({fileSystem, input}: Configuration) {
        this.fileSystem = fileSystem;
        this.input = input;
    }

    public async execute({path, content, ...options}: WriteFileOptions): Promise<void> {
        let overwrite = options.overwrite === true;

        if (!overwrite && await this.fileSystem.exists(path)) {
            overwrite = this.input === undefined
                ? false
                : await this.input.confirm({
                    message: `Path \`${path}\` already exists. Do you want to overwrite it?`,
                    default: false,
                });

            if (!overwrite) {
                throw new ActionError('Failed to write file because the specified path already exists.', {
                    reason: ErrorReason.PRECONDITION,
                    details: [
                        `File: ${path}`,
                    ],
                });
            }
        }

        if (overwrite && await this.fileSystem.isDirectory(path)) {
            await this.fileSystem.delete(path, {
                recursive: true,
            });
        }

        try {
            await this.fileSystem.writeTextFile(path, content, {
                overwrite: overwrite,
            });
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
