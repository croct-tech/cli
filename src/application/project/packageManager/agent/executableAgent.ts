import {Command} from '@/application/system/process/command';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {PackageManagerAgent} from '@/application/project/packageManager/agent/packageManagerAgent';
import {CommandOptions, PackageManagerError} from '@/application/project/packageManager/packageManager';
import {CommandExecutor} from '@/application/system/process/executor';
import {FileSystem} from '@/application/fs/fileSystem';
import {ExecutableLocator} from '@/application/system/executableLocator';

export type Configuration = {
    projectDirectory: WorkingDirectory,
    fileSystem: FileSystem,
    commandExecutor: CommandExecutor,
    executableLocator: ExecutableLocator,
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

    public addDependencies(packages: string[], dev = false): Promise<void> {
        return this.run(this.createAddDependencyCommand(packages, dev));
    }

    public installDependencies(): Promise<void> {
        return this.run(this.createInstallDependenciesCommand());
    }

    public getPackageCommand(packageName: string, args?: string[]): Promise<Command> {
        return this.createPackageCommand(packageName, args);
    }

    public getScriptCommand(script: string, args?: string[]): Promise<Command> {
        return this.createScriptCommand(script, args);
    }

    protected abstract getCommandName(): string;

    protected abstract createScriptCommand(script: string, args?: string[]): Promise<Command>;

    protected abstract createPackageCommand(packageName: string, args?: string[]): Promise<Command>;

    protected abstract createAddDependencyCommand(dependencies: string[], dev: boolean): Command;

    protected abstract createInstallDependenciesCommand(): Command;

    protected async run(command: Command, options: CommandOptions = {}): Promise<void> {
        if (!await this.isInstalled()) {
            throw new PackageManagerError(`Package manager \`${this.getCommandName()}\` is not installed.`);
        }

        const execution = this.commandRunner.run(command, {
            ...options,
            workingDirectory: this.projectDirectory.get(),
        });

        if (await execution.wait() !== 0) {
            throw new PackageManagerError(`Failed to run \`${command.name}\` command.`);
        }
    }

    private getExecutable(command: string): Promise<string|null> {
        return this.executableLocator.locate(command);
    }
}
