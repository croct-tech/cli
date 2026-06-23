import {ExecutableAgent} from '@/application/project/packageManager/agent/executableAgent';
import type {Command} from '@/application/system/process/command';

/**
 * Package manager agent backed by the Composer executable.
 *
 * Builds the Composer commands for installing, updating, and running packages
 * and scripts in a PHP project.
 */
export class ComposerAgent extends ExecutableAgent {
    protected getCommandName(): string {
        return 'composer';
    }

    protected createPackageCommand(packageName: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(
            this.getCommand('composer', ['exec', packageName, ...(args.length > 0 ? ['--', ...args] : [])]),
        );
    }

    protected createScriptCommand(script: string, args: string[] = []): Promise<Command> {
        return Promise.resolve(
            this.getCommand('composer', ['run-script', script, ...(args.length > 0 ? ['--', ...args] : [])]),
        );
    }

    protected createAddDependencyCommand(dependencies: string[], dev: boolean): Promise<Command> {
        return Promise.resolve(
            this.getCommand('composer', ['require', ...(dev ? ['--dev'] : []), ...dependencies]),
        );
    }

    protected createInstallDependenciesCommand(): Promise<Command> {
        return Promise.resolve(this.getCommand('composer', ['install']));
    }

    protected createPackageUpdateCommand(packageName: string, global = false): Promise<Command> {
        return Promise.resolve(
            this.getCommand('composer', [...(global ? ['global'] : []), 'update', packageName]),
        );
    }

    private getCommand(command: string, args: string[] = []): Command {
        return {
            name: command,
            arguments: args,
        };
    }
}
