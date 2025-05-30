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
        if (!await this.fileSystem.exists(path)) {
            throw new ActionError('Cannot move path because source does not exist.', {
                reason: ErrorReason.INVALID_INPUT,
                details: [
                    `Source: ${path}`,
                ],
            });
        }

        if (await this.fileSystem.exists(destination) && !overwrite) {
            throw new ActionError('Cannot move path because destination already exists.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `Destination: ${destination}`,
                ],
            });
        }

        if (this.fileSystem.isSubPath(path, destination)) {
            throw new ActionError('Cannot move path to a subdirectory of itself.', {
                reason: ErrorReason.INVALID_INPUT,
                details: [
                    `Source: ${path}`,
                    `Destination: ${destination}`,
                ],
            });
        }

        try {
            await this.fileSystem.move(path, destination, {
                overwrite: overwrite,
            });
        } catch (error) {
            throw ActionError.fromCause(error);
        }
    }
}
