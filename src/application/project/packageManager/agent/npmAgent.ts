import {ExecutableAgent} from '@/application/project/packageManager/agent/executableAgent';
import {Command} from '@/application/process/command';

export class NpmAgent extends ExecutableAgent {
    protected getCommandName(): string {
        return 'npm';
    }

    public getPackageCommand(packageName: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(this.getCommand('npx', ['--yes', packageName, ...args]));
    }

    public getScriptCommand(script: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(
            this.getCommand(
                this.getCommandName(),
                ['run', script, ...(args.length > 0 ? ['--', ...args] : [])],
            ),
        );
    }

    protected getAddDependencyCommand(dependencies: string[], dev: boolean): Command {
        return this.getCommand(this.getCommandName(), ['install', ...(dev ? ['--save-dev'] : []), ...dependencies]);
    }

    protected getInstallDependenciesCommand(): Command {
        return this.getCommand(this.getCommandName(), ['install']);
    }

    private getCommand(command: string, args: string[] = []): Command {
        return {
            name: command,
            arguments: args,
        };
    }
}
