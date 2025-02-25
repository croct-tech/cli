import {Action, ActionError} from '@/application/template/action/action';
import {CurrentWorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {FileSystem} from '@/application/fs/fileSystem';
import {ErrorReason} from '@/application/error';

export type ChangeDirectoryOptions = {
    path: string,
};

export type Configuration = {
    fileSystem: FileSystem,
    rootDirectory: string,
    currentDirectory: CurrentWorkingDirectory,
};

export class ChangeDirectoryAction implements Action<ChangeDirectoryOptions> {
    private readonly fileSystem: FileSystem;

    private readonly rootDirectory: string;

    private readonly currentDirectory: CurrentWorkingDirectory;

    public constructor({fileSystem, rootDirectory, currentDirectory}: Configuration) {
        this.fileSystem = fileSystem;
        this.rootDirectory = rootDirectory;
        this.currentDirectory = currentDirectory;
    }

    public execute(options: ChangeDirectoryOptions): Promise<void> {
        const target = this.fileSystem.isAbsolutePath(options.path)
            ? options.path
            : this.fileSystem.joinPaths(this.currentDirectory.get(), options.path);

        if (!this.fileSystem.isSubPath(this.rootDirectory, target)) {
            throw new ActionError('Cannot change to a directory outside the current working directory.', {
                reason: ErrorReason.PRECONDITION,
                details: [
                    `Working directory: ${this.rootDirectory}`,
                    `Target directory: ${target}`,
                ],
            });
        }

        this.currentDirectory.setCurrentDirectory(target);

        return Promise.resolve();
    }
}
