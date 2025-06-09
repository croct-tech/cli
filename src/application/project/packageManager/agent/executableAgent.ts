import {Logger, LogLevel} from '@croct/logging';
import {Command} from '@/application/system/process/command';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {PackageManagerAgent} from '@/application/project/packageManager/agent/packageManagerAgent';
import {
    AddDependencyOptions,
    CommandOptions as BaseCommandOptions,
    InstallDependenciesOptions,
    PackageManagerError,
    UpdateCommandOptions,
    UpdatePackageOptions,
} from '@/application/project/packageManager/packageManager';
import {CommandExecutor} from '@/application/system/process/executor';
import {FileSystem} from '@/application/fs/fileSystem';
import {ExecutableLocator} from '@/application/system/executableLocator';
import {ScreenBuffer} from '@/application/cli/io/screenBuffer';

export type Configuration = {
    projectDirectory: WorkingDirectory,
    fileSystem: FileSystem,
    commandExecutor: CommandExecutor,
    executableLocator: ExecutableLocator,
};

type CommandOptions = BaseCommandOptions & {
    logger?: Logger,
};

export abstract class ExecutableAgent implements PackageManagerAgent {
    private readonly projectDirectory: WorkingDirectory;

    private readonly commandRunner: CommandExecutor;

    private readonly executableLocator: ExecutableLocator;

    private installed: Promise<boolean>;

    public constructor(configuration: Configuration) {
        this.projectDirectory = configuration.projectDirectory;
        this.commandRunner = configuration.commandExecutor;
        this.executableLocator = configuration.executableLocator;
    }

    public isInstalled(): Promise<boolean> {
        if (this.installed === undefined) {
            this.installed = this.getExecutable(this.getCommandName())
                .then(executable => executable !== null);
        }

        return this.installed;
    }

    public getName(): Promise<string> {
        return Promise.resolve(this.getCommandName());
    }

    public async addDependencies(packages: string[], options?: AddDependencyOptions): Promise<void> {
        return this.run(await this.createAddDependencyCommand(packages, options?.dev ?? false), {
            logger: options?.logger,
        });
    }

    public async installDependencies(options?: InstallDependenciesOptions): Promise<void> {
        return this.run(await this.createInstallDependenciesCommand(), {
            logger: options?.logger,
        });
    }

    public async updatePackage(packageName: string, options?: UpdatePackageOptions): Promise<void> {
        return this.run(await this.createPackageUpdateCommand(packageName, options?.global ?? false), {
            logger: options?.logger,
        });
    }

    public getPackageCommand(packageName: string, args?: string[]): Promise<Command> {
        return this.createPackageCommand(packageName, args);
    }

    public getPackageUpdateCommand(packageName: string, options: UpdateCommandOptions = {}): Promise<Command> {
        return this.createPackageUpdateCommand(packageName, options.global ?? false);
    }

    public getScriptCommand(script: string, args?: string[]): Promise<Command> {
        return this.createScriptCommand(script, args);
    }

    protected abstract getCommandName(): string;

    protected abstract createScriptCommand(script: string, args?: string[]): Promise<Command>;

    protected abstract createPackageCommand(packageName: string, args?: string[]): Promise<Command>;

    protected abstract createPackageUpdateCommand(packageName: string, global?: boolean): Promise<Command>;

    protected abstract createAddDependencyCommand(dependencies: string[], dev: boolean): Promise<Command>;

    protected abstract createInstallDependenciesCommand(): Promise<Command>;

    protected async run(command: Command, {logger, ...options}: CommandOptions = {}): Promise<void> {
        if (!await this.isInstalled()) {
            throw new PackageManagerError(`Package manager \`${this.getCommandName()}\` is not installed.`);
        }

        const execution = await this.commandRunner.run(command, {
            ...options,
            workingDirectory: this.projectDirectory.get(),
        });

        const buffer = new ScreenBuffer();

        for await (const line of execution.output) {
            buffer.write(line);
            logger?.log({
                level: LogLevel.DEBUG,
                message: ScreenBuffer.getRawString(line).trim(),
                details: {
                    output: ScreenBuffer.getRawString(buffer.getSnapshot()).trim(),
                },
            });
        }

        if (await execution.wait() !== 0) {
            const output = ScreenBuffer.getRawString(buffer.getSnapshot()).trim();

            logger?.log({
                level: LogLevel.ERROR,
                message: `Failed to run \`${command.name}\` command.`,
                details: {
                    command: command.name,
                    arguments: command.arguments ?? [],
                    output: output,
                },
            });

            throw new PackageManagerError(
                `Failed to run \`${command.name}\` command${output === '' ? '.' : `:\n\n${output}`}`,
            );
        }
    }

    private getExecutable(command: string): Promise<string | null> {
        return this.executableLocator.locate(command);
    }
}
