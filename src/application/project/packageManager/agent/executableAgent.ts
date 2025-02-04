import which from 'which';
import {Command} from '@/application/process/command';
import {WorkingDirectory} from '@/application/fs/workingDirectory';
import {PackageManagerAgent} from '@/application/project/packageManager/agent/packageManagerAgent';
import {CommandOptions, PackageManagerError} from '@/application/project/packageManager/packageManager';
import {CommandExecutor} from '@/application/process/executor';

export type Configuration = {
    projectDirectory: WorkingDirectory,
    commandRunner: CommandExecutor,
};

export abstract class ExecutableAgent implements PackageManagerAgent {
    protected readonly projectDirectory: WorkingDirectory;

    private readonly commandRunner: CommandExecutor;

    private installed: Promise<boolean>;

    public constructor({projectDirectory, commandRunner}: Configuration) {
        this.projectDirectory = projectDirectory;
        this.commandRunner = commandRunner;
    }

    public isInstalled(): Promise<boolean> {
        if (this.installed === undefined) {
            this.installed = which(this.getCommandName(), {nothrow: true})
                .then(result => result !== null);
        }

        return this.installed;
    }

    public addDependencies(packages: string[], dev = false): Promise<void> {
        return this.run(this.getAddDependencyCommand(packages, dev));
    }

    public installDependencies(): Promise<void> {
        return this.run(this.getInstallDependenciesCommand());
    }

    public abstract getScriptCommand(script: string, args?: string[]): Promise<Command>;

    public abstract getPackageCommand(packageName: string, args?: string[]): Promise<Command>;

    protected abstract getCommandName(): string;

    protected abstract getAddDependencyCommand(dependencies: string[], dev: boolean): Command;

    protected abstract getInstallDependenciesCommand(): Command;

    protected async run(command: Command, options: CommandOptions = {}): Promise<void> {
        if (!await this.isInstalled()) {
            throw new PackageManagerError(`Unable to find \`${this.getCommandName()}\` executable.`);
        }

        const execution = this.commandRunner.run(command, {
            ...options,
            workingDirectory: this.projectDirectory.get(),
        });

        if (await execution.wait() !== 0) {
            throw new PackageManagerError(`Failed to run \`${command.name}\` command.`);
        }
    }
}
