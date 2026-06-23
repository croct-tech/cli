import type {CodeFormatter} from '@/application/project/code/formatting/formatter';
import type {FileSystem} from '@/application/fs/fileSystem';
import type {PackageManager} from '@/application/project/packageManager/packageManager';
import type {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import type {SynchronousCommandExecutor} from '@/application/system/process/executor';
import type {Command} from '@/application/system/process/command';

type FormatterTool = {
    package: string,
    binary: string,
    args(files: string[]): string[],
};

export type Configuration = {
    workingDirectory: WorkingDirectory,
    fileSystem: FileSystem,
    packageManager: PackageManager,
    commandExecutor: SynchronousCommandExecutor,
    timeout?: number,
    tools: FormatterTool[],
};

/**
 * Formats PHP code with whichever formatter the project already uses.
 *
 * Detects the first configured tool present as a direct dependency and runs its
 * Composer-linked binary so the project's own ruleset applies. Formatting is
 * best-effort: when no supported tool is installed, or the run fails, it is
 * silently skipped so it never blocks the surrounding command.
 */
export class PhpFormatter implements CodeFormatter {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public async format(files: string[]): Promise<void> {
        if (files.length === 0) {
            return;
        }

        const command = await this.getCommand(files);

        if (command === null) {
            return;
        }

        const {commandExecutor, workingDirectory, timeout} = this.configuration;

        try {
            commandExecutor.runSync(command, {
                workingDirectory: workingDirectory.get(),
                timeout: timeout,
            });
        } catch {
            // suppress
        }
    }

    private async getCommand(files: string[]): Promise<Command | null> {
        const {tools, packageManager, fileSystem, workingDirectory} = this.configuration;

        for (const tool of tools) {
            if (await packageManager.hasDirectDependency(tool.package)) {
                return {
                    name: fileSystem.joinPaths(workingDirectory.get(), 'vendor', 'bin', tool.binary),
                    arguments: tool.args(files),
                };
            }
        }

        return null;
    }
}
