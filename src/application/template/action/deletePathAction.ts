import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';

export type DeletePathOptions = {
    path: string,
    recursive?: boolean,
};

export type Configuration = {
    fileSystem: FileSystem,
};

export class DeletePathAction implements Action<DeletePathOptions> {
    private readonly fileSystem: FileSystem;

    public constructor({fileSystem}: Configuration) {
        this.fileSystem = fileSystem;
    }

    public async execute({path, recursive = false}: DeletePathOptions): Promise<void> {
        if (!await this.fileSystem.exists(path)) {
            return;
        }

        if (!recursive && await this.fileSystem.isDirectory(path) && !await this.fileSystem.isEmptyDirectory(path)) {
            throw new ActionError('Cannot delete non-empty directory when `recursive` is false.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `Path: ${path}`,
                ],
            });
        }

        try {
            await this.fileSystem.delete(path, {
                recursive: recursive,
            });
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
