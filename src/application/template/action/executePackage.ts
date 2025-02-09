import stripAnsi from 'strip-ansi';
import {Action, ActionError} from '@/application/template/action/action';
import {ErrorReason} from '@/application/error';
import {ActionContext} from '@/application/template/action/context';
import {Command} from '@/application/process/command';
import {WorkingDirectory} from '@/application/fs/workingDirectory';
import {PackageManager} from '@/application/project/packageManager/packageManager';
import {Provider} from '@/application/provider/provider';
import {CommandExecutor} from '@/application/process/executor';
import {Predicate} from '@/application/predicate/predicate';

export type Interactions = {
    when: string,
    once?: boolean,
    then: string[],
};

export type ExecutePackageOptions = {
    runner?: string,
    package: string,
    arguments?: string[],
    interactions?: Interactions[],
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

        const fullCommand = [command.name, ...(command.arguments ?? [])].join(' ');

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

        const notifier = output.notify(`Running \`${fullCommand}\``);

        try {
            await this.executeCommand(command, options.interactions);
        } catch (error) {
            throw ActionError.fromCause(error);
        } finally {
            notifier.stop();
        }
    }

    private getPackageManager(name?: string): Promise<PackageManager>|PackageManager {
        if (name === undefined) {
            return this.configuration.packageManager;
        }

        return this.configuration
            .packageManagerProvider
            .get(name);
    }

    private async executeCommand(command: Command, interactions: Interactions[] = []): Promise<void> {
        const {workingDirectory, commandExecutor, commandTimeout} = this.configuration;

        const execution = commandExecutor.run(command, {
            workingDirectory: workingDirectory.get(),
            timeout: commandTimeout,
        });

        const nextInteractions = [...interactions];

        let output = '';

        for await (const line of execution.output) {
            const lineText = stripAnsi(line);

            output += lineText;

            for (const [index, interaction] of nextInteractions.entries()) {
                if (lineText.includes(interaction.when)) {
                    if (interaction.once === true) {
                        nextInteractions.splice(index, 1);
                    }

                    for (const input of interaction.then) {
                        await execution.write(ExecutePackage.INPUT_MAP[input] ?? input);
                    }

                    break;
                }
            }
        }

        let exitCode = -1;
        let executionError: any;

        try {
            exitCode = await execution.wait();
        } catch (error) {
            executionError = error;
        }

        if (exitCode !== 0) {
            throw new ActionError(`Command failed with output:\n\n${output}`, {
                reason: ErrorReason.UNEXPECTED_RESULT,
                cause: executionError,
            });
        }
    }
}
