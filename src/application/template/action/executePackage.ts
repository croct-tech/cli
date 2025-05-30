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

export type Interactions = {
    when: string,
    pattern?: boolean,
    always?: boolean,
    then?: string[],
    final?: boolean,
};

export type ExecutePackageOptions = {
    runner?: string,
    package: string,
    arguments?: string[],
    interactions?: Interactions[] | boolean,
    output?: string,
};

export type Configuration = {
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

        const packageManager = await this.getPackageManager(options.runner);
        const command = await packageManager.getPackageCommand(options.package, options.arguments);

        const fullCommand = [
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

        if (!await sourceChecker.test(context.baseUrl)) {
            if (input === undefined) {
                throw new ActionError('Action requires explicit user confirmation.', {
                    reason: ErrorReason.PRECONDITION,
                    details: [
                        'Retry in interactive mode.',
                    ],
                });
            }

            output.warn(`This template will run the command \`${fullCommand}\``);

            if (!await input.confirm({message: 'Continue?', default: true})) {
                throw new ActionError('Permission to run command denied.', {
                    reason: ErrorReason.PRECONDITION,
                    details: [
                        `Command: ${fullCommand}`,
                    ],
                });
            }
        }

        let notifier: Notifier|null = null;

        const log = `Running \`${fullCommand}\``;

        if (options.interactions !== true) {
            notifier = output.notify(log);
        } else {
            output.log(log);
        }

        let commandOutput: string;

        try {
            commandOutput = await this.executeCommand(command, options.interactions ?? false);
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier?.stop();
        }

        if (options.output !== undefined) {
            context.set(options.output, commandOutput);
        }
    }

    private getPackageManager(name?: string): Promise<PackageManager> | PackageManager {
        if (name === undefined) {
            return this.configuration.packageManager;
        }

        return this.configuration
            .packageManagerProvider
            .get(name);
    }

    private async executeCommand(command: Command, interactions: Interactions[]|boolean): Promise<string> {
        const {workingDirectory, commandExecutor, commandTimeout} = this.configuration;

        const execution = await commandExecutor.run(command, {
            workingDirectory: workingDirectory.get(),
            timeout: commandTimeout,
            inheritIo: interactions === true,
        });

        const buffer = new ScreenBuffer();

        if (interactions !== true) {
            const nextInteractions = Array.isArray(interactions) ? [...interactions] : [];

            if (nextInteractions.length === 0) {
                await execution.endWriting();
            }

            for await (const line of execution.output) {
                buffer.write(line);

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

        const output = ScreenBuffer.getRawString(buffer.getSnapshot());

        if (exitCode !== 0) {
            throw new ActionError(
                `Command execution failed${output === '' ? '.' : `with output:\n\n${output}`}`,
                {
                    reason: ErrorReason.UNEXPECTED_RESULT,
                },
            );
        }

        return output;
    }
}
