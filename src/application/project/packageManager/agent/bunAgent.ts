import {ExecutableAgent} from '@/application/project/packageManager/agent/executableAgent';
import {Command} from '@/application/system/process/command';

export class BunAgent extends ExecutableAgent {
    protected getCommandName(): string {
        return 'bun';
    }

    protected createPackageCommand(packageName: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(this.getCommand(['x', packageName, ...args]));
    }

    protected createScriptCommand(script: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(this.getCommand(['run', script, ...args]));
    }

    protected createAddDependencyCommand(dependencies: string[], dev: boolean): Promise<Command> {
        return Promise.resolve(this.getCommand(['install', ...(dev ? ['--dev'] : []), ...dependencies]));
    }

    protected createInstallDependenciesCommand(): Promise<Command> {
        return Promise.resolve(this.getCommand(['install']));
    }

    protected createPackageUpdateCommand(packageName: string, global = false): Promise<Command> {
        return Promise.resolve(this.getCommand(['update', ...(global ? ['--global'] : []), packageName]));
    }

    private getCommand(args: string[] = []): Command {
        return {
            name: this.getCommandName(),
            arguments: args,
        };
    }
}
