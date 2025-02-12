import {ExecutableAgent} from '@/application/project/packageManager/agent/executableAgent';
import {Command} from '@/application/system/process/command';

export class YarnAgent extends ExecutableAgent {
    protected getCommandName(): string {
        return 'yarn';
    }

    protected createPackageCommand(packageName: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(this.getCommand(['dlx', packageName, ...args]));
    }

    protected createScriptCommand(script: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(this.getCommand(['run', script, ...args]));
    }

    protected createAddDependencyCommand(dependencies: string[], dev: boolean): Command {
        return this.getCommand(['add', ...(dev ? ['--dev'] : []), ...dependencies]);
    }

    protected createInstallDependenciesCommand(): Command {
        return this.getCommand(['install']);
    }

    private getCommand(args: string[] = []): Command {
        return {
            name: this.getCommandName(),
            arguments: args,
        };
    }
}
