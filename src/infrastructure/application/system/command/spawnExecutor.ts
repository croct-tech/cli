import {spawn, spawnSync} from 'child_process';
import {
    CommandExecutor,
    DisposableListener,
    Execution,
    ExecutionError,
    ExecutionOptions,
    ExecutionResult,
    ExitCallback,
    SynchronousCommandExecutor,
} from '@/application/system/process/executor';
import {BufferedIterator} from '@/infrastructure/bufferedIterator';
import {ErrorReason, HelpfulError} from '@/application/error';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {Command} from '@/application/system/process/command';

export type Configuration = {
    currentDirectory?: WorkingDirectory,
    windows?: boolean,
};

type PreparedCommand = Command & {
    shell: boolean,
};

export class SpawnExecutor implements CommandExecutor, SynchronousCommandExecutor {
    private readonly currentDirectory?: WorkingDirectory;

    private readonly isWindows: boolean;

    public constructor({currentDirectory, windows = false}: Configuration) {
        this.currentDirectory = currentDirectory;
        this.isWindows = windows;
    }

    public run(command: Command, options: ExecutionOptions = {}): Promise<Execution> {
        const timeoutSignal = options.timeout !== undefined
            ? AbortSignal.timeout(options.timeout)
            : undefined;

        const preparedCommand = this.prepareCommand(command);

        const subprocess = spawn(preparedCommand.name, preparedCommand.arguments, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: preparedCommand.shell,
            cwd: options?.workingDirectory ?? this.currentDirectory?.get(),
            signal: timeoutSignal,
        });

        const output = new BufferedIterator<string>();
        const errorCallbacks: Array<(error: unknown) => void> = [];
        let lastError: ExecutionError|null = null;

        subprocess.on('error', (error: unknown) => {
            output.close();

            lastError = timeoutSignal?.aborted === true
                ? new ExecutionError('Command timed out.', {
                    reason: ErrorReason.PRECONDITION,
                    cause: error,
                })
                : new ExecutionError(`Failed to run command: ${HelpfulError.formatCause(error)}`, {
                    cause: error,
                });

            for (const callback of errorCallbacks) {
                callback(lastError);
            }
        });

        subprocess.stdout.on('data', data => {
            output.push(data.toString());
        });

        subprocess.stderr.on('data', data => {
            output.push(data.toString());
        });

        const exitListeners: ExitCallback[] = [];

        subprocess.on('exit', code => {
            output.close();

            for (const listener of exitListeners) {
                listener(code ?? 1);
            }
        });

        return Promise.resolve({
            output: output,
            get running(): boolean {
                return subprocess.exitCode === null;
            },
            onExit: (callback: ExitCallback): DisposableListener => {
                exitListeners.push(callback);

                return () => {
                    const index = exitListeners.indexOf(callback);

                    if (index !== -1) {
                        exitListeners.splice(index, 1);
                    }
                };
            },
            write: (data: string) => new Promise((resolve, reject) => {
                subprocess.stdin.write(data, error => {
                    if (error === null) {
                        resolve();
                    } else {
                        reject(error);
                    }
                });
            }),
            endWriting: () => new Promise<void>(resolve => {
                if (subprocess.exitCode !== null) {
                    resolve();

                    return;
                }

                subprocess.stdin.end(resolve);
            }),
            read: async (): Promise<string> => {
                let data = '';

                for await (const chunk of output) {
                    data += chunk;
                }

                return data;
            },
            wait: () => new Promise<number>((resolve, reject) => {
                if (lastError !== null) {
                    reject(lastError);

                    return;
                }

                if (subprocess.exitCode !== null) {
                    resolve(subprocess.exitCode);

                    return;
                }

                errorCallbacks.push(reject);

                subprocess.on('exit', code => {
                    resolve(code ?? 1);
                });
            }),
            kill: signal => new Promise<void>((resolve, reject) => {
                if (subprocess.exitCode !== null) {
                    resolve();

                    return;
                }

                subprocess.stdout.destroy();
                subprocess.stderr.destroy();
                subprocess.stdin.destroy();

                if (subprocess.kill(signal)) {
                    resolve();
                } else {
                    reject(new ExecutionError('Failed to kill the subprocess.'));
                }
            }),
        });
    }

    public runSync(command: Command, options: ExecutionOptions = {}): ExecutionResult {
        const timeoutSignal = options.timeout !== undefined
            ? AbortSignal.timeout(options.timeout)
            : undefined;

        const preparedCommand = this.prepareCommand(command);
        const subprocess = spawnSync(preparedCommand.name, preparedCommand.arguments, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: options?.workingDirectory ?? this.currentDirectory?.get(),
            shell: preparedCommand.shell,
            signal: timeoutSignal,
        });

        if (subprocess.error !== undefined) {
            const {error} = subprocess;

            if (timeoutSignal?.aborted === true) {
                throw new ExecutionError('Command timed out.', {
                    reason: ErrorReason.PRECONDITION,
                    cause: error,
                });
            }

            throw new ExecutionError(`Failed to run command: ${HelpfulError.formatCause(error)}`, {
                cause: error,
            });
        }

        let output = subprocess.stdout.toString();

        const stderr = subprocess.stderr.toString();

        if (output !== '' && stderr !== '') {
            output = `${output}\n${stderr}`;
        }

        return {
            exitCode: subprocess.status ?? 1,
            output: output,
        };
    }

    private prepareCommand(command: Command): PreparedCommand {
        if (!this.isWindowShell(command.name)) {
            return {
                ...command,
                shell: false,
            };
        }

        return {
            name: SpawnExecutor.escapeCommand(command.name),
            arguments: (command.arguments ?? []).map(SpawnExecutor.escapeArgument),
            // Node does not allow to spawn .bat or .cmd files on Windows because
            // arguments are not escaped:
            // https://github.com/nodejs/node/commit/69ffc6d50dbd9d7d0257f5b9b403026e1aa205ee
            shell: true,
        };
    }

    private isWindowShell(executable: string): boolean {
        return this.isWindows && (executable.endsWith('.bat') || executable.endsWith('.cmd'));
    }

    private static escapeCommand(command: string): string {
        return `"${command}"`;
    }

    private static escapeArgument(value: string): string {
        return `"${value.replace('\\', '\\\\').replace('"', '\\"')}"`;
    }
}
