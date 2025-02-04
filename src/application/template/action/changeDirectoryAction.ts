import {Action, ActionError} from '@/application/template/action/action';
import {CurrentWorkingDirectory} from '@/application/fs/workingDirectory';
import {FileSystem} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';

export type ChangeDirectoryOptions = {
    path: string,
};

export type Configuration = {
    fileSystem: FileSystem,
    currentDirectory: CurrentWorkingDirectory,
};

export class ChangeDirectoryAction implements Action<ChangeDirectoryOptions> {
    private readonly fileSystem: FileSystem;

    private readonly currentDirectory: CurrentWorkingDirectory;

    public constructor({fileSystem, currentDirectory}: Configuration) {
        this.fileSystem = fileSystem;
        this.currentDirectory = currentDirectory;
    }

    public execute(options: ChangeDirectoryOptions): Promise<void> {
        const currentDirectory = this.currentDirectory.get();

        const target = this.fileSystem.isAbsolutePath(options.path)
            ? options.path
            : this.fileSystem.joinPaths(currentDirectory, options.path);

        if (!this.fileSystem.isSubPath(currentDirectory, target)) {
            throw new ActionError('Cannot change to a directory outside the current directory', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `Current directory: ${currentDirectory}`,
                    `Target directory: ${target}`,
                ],
            });
        }

        this.currentDirectory.setCurrentDirectory(target);

        return Promise.resolve();
    }
}
