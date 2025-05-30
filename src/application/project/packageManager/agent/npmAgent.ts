import {ExecutableAgent} from '@/application/project/packageManager/agent/executableAgent';
import {Command} from '@/application/system/process/command';

export class NpmAgent extends ExecutableAgent {
    protected getCommandName(): string {
        return 'npm';
    }

    protected createPackageCommand(packageName: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(this.getCommand('npx', ['--yes', packageName, ...args]));
    }

    protected createScriptCommand(script: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(
            this.getCommand(
                this.getCommandName(),
                ['run', script, ...(args.length > 0 ? ['--', ...args] : [])],
            ),
        );
    }

    protected createAddDependencyCommand(dependencies: string[], dev: boolean): Promise<Command> {
        return Promise.resolve(
            this.getCommand(
                this.getCommandName(),
                ['install', ...(dev ? ['--save-dev'] : []), ...dependencies],
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
                ['update', ...(global ? ['--global'] : []), packageName],
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
