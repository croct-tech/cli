import type {CommandExecutor, Execution, ExecutionOptions} from '@/application/system/process/executor';
import {ExecutionError} from '@/application/system/process/executor';
import type {Command} from '@/application/system/process/command';
import type {ExecutableLocator} from '@/application/system/executableLocator';

export type Configuration = {
    commandExecutor: CommandExecutor,
    executableLocator: ExecutableLocator,
};

export class ResolvedCommandExecutor implements CommandExecutor {
    private readonly executableLocator: ExecutableLocator;

    private readonly commandExecutor: CommandExecutor;

    public constructor({commandExecutor, executableLocator}: Configuration) {
        this.executableLocator = executableLocator;
        this.commandExecutor = commandExecutor;
    }

    public async run(command: Command, options: ExecutionOptions = {}): Promise<Execution> {
        const executable = await this.executableLocator.locate(command.name);

        if (executable === null) {
            throw new ExecutionError(`Unable to locate executable for command \`${command.name}\`.`);
        }

        return this.commandExecutor.run(
            {
                ...command,
                name: executable,
            },
            options,
        );
    }
}
