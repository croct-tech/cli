import {CodeFormatter, CodeFormatterError} from '@/application/project/code/formatter/formatter';
import {FileSystem} from '@/application/fs/fileSystem';
import {Dependency, PackageManager} from '@/application/project/packageManager/packageManager';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {CommandExecutor} from '@/application/system/process/executor';
import {Command} from '@/application/system/process/command';

type FormatterTool = {
    package: string,
    bin?: string,
    args(files: string[]): string[],
};

export type Configuration = {
    workingDirectory: WorkingDirectory,
    fileSystem: FileSystem,
    packageManager: PackageManager,
    commandExecutor: CommandExecutor,
    timeout?: number,
    tools: FormatterTool[],
};

export class JavaScriptFormatter implements CodeFormatter {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public async format(files: string[]): Promise<void> {
        const command = await this.getCommand(files);

        if (command === null) {
            return;
        }

        try {
            await this.run(command);
        } catch {
            // suppress
        }
    }

    private async run(command: Command): Promise<void> {
        const {commandExecutor, workingDirectory, timeout} = this.configuration;

        const execution = commandExecutor.run(command, {
            workingDirectory: workingDirectory.get(),
            timeout: timeout,
        });

        if (await execution.wait() !== 0) {
            throw new CodeFormatterError('Failed to format code.');
        }
    }

    private async getCommand(files: string[]): Promise<Command|null> {
        const {tools, packageManager, fileSystem} = this.configuration;

        for (const tool of tools) {
            if (!await packageManager.hasDependency(tool.package)) {
                // Ensure the package is a direct dependency
                continue;
            }

            const info = await packageManager.getDependency(tool.package);

            if (info === null) {
                continue;
            }

            const bin = JavaScriptFormatter.getBinPath(info, tool.bin);

            if (bin === null) {
                continue;
            }

            return {
                name: fileSystem.joinPaths(info.directory, fileSystem.normalizeSeparators(bin)),
                arguments: tool.args(files),
            };
        }

        return null;
    }

    private static getBinPath({metadata}: Dependency, bin?: string): string|null {
        if (!('bin' in metadata)) {
            return null;
        }

        if (typeof metadata.bin === 'string') {
            return metadata.bin;
        }

        if (
            bin !== undefined
            && typeof metadata.bin === 'object'
            && metadata.bin !== null
            && typeof metadata.bin[bin] === 'string'
        ) {
            return metadata.bin[bin];
        }

        return null;
    }
}
