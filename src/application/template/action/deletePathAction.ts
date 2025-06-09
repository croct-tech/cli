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
        const normalizedPath = this.fileSystem.normalizeSeparators(path);

        if (!await this.fileSystem.exists(normalizedPath)) {
            return;
        }

        if (
            !recursive
            && await this.fileSystem.isDirectory(normalizedPath)
            && !await this.fileSystem.isEmptyDirectory(normalizedPath)
        ) {
            throw new ActionError('Cannot delete non-empty directory when `recursive` is false.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `Path: ${normalizedPath}`,
                ],
            });
        }

        try {
            await this.fileSystem.delete(normalizedPath, {
                recursive: recursive,
            });
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
