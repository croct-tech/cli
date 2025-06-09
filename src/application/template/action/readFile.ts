import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';
import {ActionContext} from '@/application/template/action/context';

export type ReadFileOptions = {
    path: string,
    optional?: boolean,
    result: string,
};

export type Configuration = {
    fileSystem: FileSystem,
};

export class ReadFileAction implements Action<ReadFileOptions> {
    private readonly fileSystem: FileSystem;

    public constructor({fileSystem}: Configuration) {
        this.fileSystem = fileSystem;
    }

    public async execute(options: ReadFileOptions, context: ActionContext): Promise<void> {
        context.set(options.result, await this.readFile(options));
    }

    private async readFile({path, optional = false}: ReadFileOptions): Promise<string|null> {
        const normalizedPath = this.fileSystem.normalizeSeparators(path);

        if (!await this.fileSystem.exists(normalizedPath)) {
            if (!optional) {
                throw new ActionError('Cannot read file because it does not exist.', {
                    reason: ErrorReason.PRECONDITION,
                    details: [
                        `Path: ${normalizedPath}`,
                    ],
                });
            }

            return null;
        }

        if (await this.fileSystem.isDirectory(normalizedPath)) {
            if (!optional) {
                throw new ActionError('Cannot read file because the specified path is a directory.', {
                    reason: ErrorReason.PRECONDITION,
                    details: [
                        `Path: ${normalizedPath}`,
                    ],
                });
            }

            return null;
        }

        try {
            return this.fileSystem.readTextFile(normalizedPath);
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
