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
        const normalizedPath = this.fileSystem.normalizeSeparators(path);

        if (await this.fileSystem.exists(normalizedPath) && !await this.fileSystem.isDirectory(normalizedPath)) {
            throw new ActionError('Cannot create directory because a file with the same name exists.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `Path: ${normalizedPath}`,
                ],
            });
        }

        try {
            await this.fileSystem.createDirectory(normalizedPath, {
                recursive: true,
            });
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
