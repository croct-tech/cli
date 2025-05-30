import {ExecutableAgent} from '@/application/project/packageManager/agent/executableAgent';
import {Command} from '@/application/system/process/command';

export class YarnAgent extends ExecutableAgent {
    protected getCommandName(): string {
        return 'yarn';
    }

    protected createPackageCommand(packageName: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(this.getCommand('npx', ['--yes', packageName, ...args]));
    }

    protected createScriptCommand(script: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(this.getCommand(this.getCommandName(), ['run', script, ...args]));
    }

    protected createAddDependencyCommand(dependencies: string[], dev: boolean): Promise<Command> {
        return Promise.resolve(
            this.getCommand(
                this.getCommandName(),
                ['add', ...(dev ? ['--dev'] : []), ...dependencies],
            ),
        );
    }

    protected createInstallDependenciesCommand(): Promise<Command> {
        return Promise.resolve(this.getCommand(this.getCommandName(), ['install']));
    }

    protected createPackageUpdateCommand(packageName: string, global = false): Promise<Command> {
        return Promise.resolve(
            this.getCommand(
                this.getCommandName(),
                global ? ['global', 'add', `${packageName}@latest`] : ['upgrade', packageName],
            ),
        );
    }

    private getCommand(command: string, args: string[] = []): Command {
        return {
            name: command,
            arguments: args,
        };
    }
}
