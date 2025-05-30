import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';

export type CreateDirectoryOptions = {
    path: string,
};

export type Configuration = {
    fileSystem: FileSystem,
};

export class CreateDirectoryAction implements Action<CreateDirectoryOptions> {
    private readonly fileSystem: FileSystem;

    public constructor({fileSystem}: Configuration) {
        this.fileSystem = fileSystem;
    }

    public async execute({path}: CreateDirectoryOptions): Promise<void> {
        if (await this.fileSystem.exists(path) && !await this.fileSystem.isDirectory(path)) {
            throw new ActionError('Cannot create directory because a file with the same name exists.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `Path: ${path}`,
                ],
            });
        }

        try {
            await this.fileSystem.createDirectory(path, {
                recursive: true,
            });
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
