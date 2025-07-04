import {LogLevel} from '@croct/logging';
import {Action, ActionError} from '@/application/template/action/action';
import {ErrorReason} from '@/application/error';
import {ActionContext} from '@/application/template/action/context';
import {Command} from '@/application/system/process/command';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {PackageManager} from '@/application/project/packageManager/packageManager';
import {Provider} from '@/application/provider/provider';
import {CommandExecutor} from '@/application/system/process/executor';
import {Predicate} from '@/application/predicate/predicate';
import {Notifier} from '@/application/cli/io/output';
import {ScreenBuffer} from '@/application/cli/io/screenBuffer';
import {TaskProgressLogger} from '@/infrastructure/application/cli/io/taskProgressLogger';
import {ProcessObserver} from '@/application/system/process/process';

export type Interactions = {
    when: string,
    pattern?: boolean,
    always?: boolean,
    then?: string[],
    final?: boolean,
};

export type ExecutePackageOptions = {
    runner?: string,
    command: string,
    script?: boolean,
    arguments?: string[],
    interactions?: Interactions[] | boolean,
    output?: string,
};

export type Configuration = {
    processObserver: ProcessObserver,
    sourceChecker: Predicate<[URL]>,
    packageManager: PackageManager,
    packageManagerProvider: Provider<PackageManager, [string]>,
    workingDirectory: WorkingDirectory,
    commandExecutor: CommandExecutor,
    commandTimeout: number,
};

export class ExecutePackage implements Action<ExecutePackageOptions> {
    private static readonly INPUT_MAP: Record<string, string> = {
        '[space]': ' ',
        '[enter]': '\n',
        '[down]': '\u001b[A',
        '[up]': '\u001b[B',
        '[left]': '\u001b[C',
        '[right]': '\u001b[D',
        '[backspace]': '\u0008',
    };

    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public async execute(options: ExecutePackageOptions, context: ActionContext): Promise<void> {
        const {input, output} = context;
        const {sourceChecker} = this.configuration;

        if (options.interactions === true && options.output !== undefined) {
            throw new ActionError('Cannot capture output when interactions are enabled.', {
                reason: ErrorReason.NOT_SUPPORTED,
                details: [
                    'Either use `interactions` or `output`, but not both.',
                ],
            });
        }

        const command = await this.resolveCommand(options);
        const formattedCommand = ExecutePackage.formatCommand(command);

        if (options.script !== true && !await sourceChecker.test(context.baseUrl)) {
            if (input === undefined) {
                throw new ActionError('Action requires explicit user confirmation.', {
                    reason: ErrorReason.PRECONDITION,
                    details: [
                        'Retry in interactive mode.',
                    ],
                });
            }

            output.warn(`This template will run the command \`${formattedCommand}\``);

            if (!await input.confirm({message: 'Continue?', default: true})) {
                throw new ActionError('Permission to run command denied.', {
                    reason: ErrorReason.PRECONDITION,
                });
            }
        }

        const notifier = output.notify(`Running \`${formattedCommand}\``);

        let commandOutput: string;

        try {
            commandOutput = await this.executeCommand(command, notifier, options.interactions ?? false);
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier?.stop();
        }

        if (options.output !== undefined) {
            context.set(options.output, commandOutput);
        }
    }

    private async resolveCommand(options: ExecutePackageOptions): Promise<Command> {
        const packageManager = await this.getPackageManager(options.runner);

        return options.script === true
            ? packageManager.getScriptCommand(options.command, options.arguments)
            : packageManager.getPackageCommand(options.command, options.arguments);
    }

    private getPackageManager(name?: string): Promise<PackageManager> | PackageManager {
        if (name === undefined) {
            return this.configuration.packageManager;
        }

        return this.configuration
            .packageManagerProvider
            .get(name);
    }

    private async executeCommand(
        command: Command,
        notifier: Notifier,
        interactions: Interactions[]|boolean,
    ): Promise<string> {
        const {processObserver, workingDirectory, commandExecutor, commandTimeout} = this.configuration;
        const execution = await commandExecutor.run(command, {
            workingDirectory: workingDirectory.get(),
            timeout: commandTimeout,
            inheritIo: interactions === true,
        });

        const kill = (): void => {
            execution.kill();
        };

        processObserver.on('exit', kill);

        execution.onExit(() => processObserver.off('exit', kill));

        const formattedCommand = ExecutePackage.formatCommand(command);

        if (interactions === true) {
            notifier.stop(true);
        }

        const buffer = new ScreenBuffer();
        const logger = new TaskProgressLogger({
            status: `Running \`${formattedCommand}\``,
            notifier: notifier,
        });

        if (interactions !== true) {
            const nextInteractions = Array.isArray(interactions) ? [...interactions] : [];

            if (nextInteractions.length === 0) {
                await execution.endWriting();
            }

            for await (const line of execution.output) {
                buffer.write(line);

                logger.log({
                    level: LogLevel.DEBUG,
                    message: ScreenBuffer.getRawString(line),
                });

                const diff = buffer.getSnapshotDiff();

                for (const [index, interaction] of nextInteractions.entries()) {
                    const matches = interaction.pattern === true
                        ? new RegExp(interaction.when).test(diff)
                        : diff.includes(interaction.when);

                    if (matches) {
                        buffer.saveSnapshot();

                        if (interaction.always !== true) {
                            nextInteractions.splice(index, 1);
                        }

                        for (const input of interaction.then ?? []) {
                            await execution.write(ExecutePackage.INPUT_MAP[input] ?? input);
                        }

                        if (interaction.final === true) {
                            await execution.endWriting();

                            nextInteractions.length = 0;
                        }

                        break;
                    }
                }
            }
        }

        let exitCode = -1;

        try {
            exitCode = await execution.wait();
        } catch (error) {
            throw new ActionError('Command execution failed.', {
                reason: ErrorReason.UNEXPECTED_RESULT,
                cause: error,
            });
        }

        const output = ScreenBuffer.getRawString(buffer.getSnapshot()).trim();

        if (exitCode !== 0) {
            throw new ActionError(
                `Command execution failed${output === '' ? '.' : `:\n\n${output}`}`,
                {
                    reason: ErrorReason.UNEXPECTED_RESULT,
                },
            );
        }

        return output;
    }

    private static formatCommand(command: Command): string {
        return [
            command.name
                .split(/[\\/]/)
                .pop(),
            ...(command.arguments ?? []).map(
                argument => (
                    !argument.startsWith('-') && argument.includes(' ')
                        ? JSON.stringify(argument)
                        : argument
                ),
            ),
        ].join(' ');
    }
}
