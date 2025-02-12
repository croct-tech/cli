import {CacheProvider, NoopCache} from '@croct/cache';
import {Command} from '@/application/system/process/command';
import {WorkingDirectory} from '@/application/fs/workingDirectory';
import {PackageManagerAgent} from '@/application/project/packageManager/agent/packageManagerAgent';
import {CommandOptions, PackageManagerError} from '@/application/project/packageManager/packageManager';
import {CommandExecutor} from '@/application/system/process/executor';
import {FileSystem} from '@/application/fs/fileSystem';

export type Configuration = {
    projectDirectory: WorkingDirectory,
    executablePaths: string[],
    executableExtensions?: string[],
    fileSystem: FileSystem,
    commandExecutor: CommandExecutor,
    executableCache?: CacheProvider<string, string|null>,
};

export abstract class ExecutableAgent implements PackageManagerAgent {
    private readonly projectDirectory: WorkingDirectory;

    private readonly executablePaths: string[];

    private readonly executableExtensions: string[];

    private readonly fileSystem: FileSystem;

    private readonly commandRunner: CommandExecutor;

    private readonly executableCache: CacheProvider<string, string|null>;

    private installed: Promise<boolean>;

    public constructor(configuration: Configuration) {
        this.projectDirectory = configuration.projectDirectory;
        this.executablePaths = configuration.executablePaths;
        this.executableExtensions = configuration.executableExtensions ?? [];
        this.fileSystem = configuration.fileSystem;
        this.commandRunner = configuration.commandExecutor;
        this.executableCache = configuration.executableCache ?? new NoopCache();
    }

    public isInstalled(): Promise<boolean> {
        if (this.installed === undefined) {
            this.installed = this.getExecutable(this.getCommandName())
                .then(executable => executable !== null);
        }

        return this.installed;
    }

    public async addDependencies(packages: string[], dev = false): Promise<void> {
        return this.run(await this.resolveCommand(this.createAddDependencyCommand(packages, dev)));
    }

    public async installDependencies(): Promise<void> {
        return this.run(await this.resolveCommand(this.createInstallDependenciesCommand()));
    }

    public async getPackageCommand(packageName: string, args?: string[]): Promise<Command> {
        return this.resolveCommand(await this.createPackageCommand(packageName, args));
    }

    public async getScriptCommand(script: string, args?: string[]): Promise<Command> {
        return this.resolveCommand(await this.createScriptCommand(script, args));
    }

    protected abstract getCommandName(): string;

    protected abstract createScriptCommand(script: string, args?: string[]): Promise<Command>;

    protected abstract createPackageCommand(packageName: string, args?: string[]): Promise<Command>;

    protected abstract createAddDependencyCommand(dependencies: string[], dev: boolean): Command;

    protected abstract createInstallDependenciesCommand(): Command;

    protected async run(command: Command, options: CommandOptions = {}): Promise<void> {
        const execution = this.commandRunner.run(command, {
            ...options,
            workingDirectory: this.projectDirectory.get(),
        });

        if (await execution.wait() !== 0) {
            throw new PackageManagerError(`Failed to run \`${command.name}\` command.`);
        }
    }

    private async resolveCommand(command: Command): Promise<Command> {
        const executable = await this.getExecutable(command.name);

        if (executable === null) {
            throw new PackageManagerError(`Unable to find \`${this.getCommandName()}\` executable.`);
        }

        return {
            ...command,
            name: executable,
        };
    }

    private getExecutable(command: string): Promise<string|null> {
        return this.executableCache.get(command, name => this.findExecutable(name));
    }

    private async findExecutable(command: string): Promise<string|null> {
        for (const path of this.executablePaths) {
            for (const extension of ['', ...this.executableExtensions]) {
                const realPath = this.fileSystem.joinPaths(path, command + extension.toLowerCase());

                if (realPath !== null && await this.fileSystem.exists(realPath)) {
                    return realPath;
                }
            }
        }

        return null;
    }
}
