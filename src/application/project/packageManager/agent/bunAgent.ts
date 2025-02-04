import {ExecutableAgent} from '@/application/project/packageManager/agent/executableAgent';
import {Command} from '@/application/process/command';

export class BunAgent extends ExecutableAgent {
    protected getCommandName(): string {
        return 'bun';
    }

    public getPackageCommand(packageName: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(this.getCommand(['x', packageName, ...args]));
    }

    public getScriptCommand(script: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(this.getCommand(['run', script, ...args]));
    }

    protected getAddDependencyCommand(dependencies: string[], dev: boolean): Command {
        return this.getCommand(['install', ...(dev ? ['--dev'] : []), ...dependencies]);
    }

    protected getInstallDependenciesCommand(): Command {
        return this.getCommand(['install']);
    }

    private getCommand(args: string[] = []): Command {
        return {
            name: this.getCommandName(),
            arguments: args,
        };
    }
}
