import {Action, ActionError} from '@/application/template/action/action';
import {FileSystem} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';

export type MovePathOptions = {
    path: string,
    destination: string,
    overwrite?: boolean,
};

export type Configuration = {
    fileSystem: FileSystem,
};

export class MovePathAction implements Action<MovePathOptions> {
    private readonly fileSystem: FileSystem;

    public constructor({fileSystem}: Configuration) {
        this.fileSystem = fileSystem;
    }

    public async execute({path, destination, overwrite = false}: MovePathOptions): Promise<void> {
        const normalizedPath = this.fileSystem.normalizeSeparators(path);

        if (!await this.fileSystem.exists(normalizedPath)) {
            throw new ActionError('Cannot move path because source does not exist.', {
                reason: ErrorReason.INVALID_INPUT,
                details: [
                    `Source: ${normalizedPath}`,
                ],
            });
        }

        const normalizedDestination = this.fileSystem.normalizeSeparators(destination);

        if (await this.fileSystem.exists(normalizedDestination) && !overwrite) {
            throw new ActionError('Cannot move path because destination already exists.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `Destination: ${normalizedDestination}`,
                ],
            });
        }

        if (this.fileSystem.isSubPath(normalizedPath, normalizedDestination)) {
            throw new ActionError('Cannot move path to a subdirectory of itself.', {
                reason: ErrorReason.INVALID_INPUT,
                details: [
                    `Source: ${normalizedPath}`,
                    `Destination: ${normalizedDestination}`,
                ],
            });
        }

        try {
            await this.fileSystem.move(normalizedPath, normalizedDestination, {
                overwrite: overwrite,
            });
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
