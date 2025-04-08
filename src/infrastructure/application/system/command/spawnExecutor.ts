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
import {ExecutableLocator} from '@/application/system/executableLocator';

export type Configuration = {
    currentDirectory?: WorkingDirectory,
    executableLocator: ExecutableLocator,
};

export class SpawnExecutor implements CommandExecutor, SynchronousCommandExecutor {
    private readonly currentDirectory?: WorkingDirectory;

    private readonly executableLocator: ExecutableLocator;

    public constructor({currentDirectory, executableLocator}: Configuration) {
        this.currentDirectory = currentDirectory;
        this.executableLocator = executableLocator;
    }

    public async run(command: Command, options: ExecutionOptions = {}): Promise<Execution> {
        const timeoutSignal = options.timeout !== undefined
            ? AbortSignal.timeout(options.timeout)
            : undefined;

        const executable = await this.executableLocator.locate(command.name);

        if (executable === null) {
            throw new ExecutionError(`Unable to locate executable for command \`${command.name}\`.`);
        }

        const shell = /\.(bat|cmd)$/i.test(executable);
        const subprocess = spawn(shell ? `"${executable}"` : executable, command.arguments, {
            stdio: ['pipe', 'pipe', 'pipe'],
            // Node does not allow to spawn .bat or .cmd files on Windows because
            // arguments are not escaped:
            // https://github.com/nodejs/node/commit/69ffc6d50dbd9d7d0257f5b9b403026e1aa205ee
            shell: shell,
            cwd: options?.workingDirectory ?? this.currentDirectory?.get(),
            signal: timeoutSignal,
        });

        const errorCallbacks: Array<(error: unknown) => void> = [];

        subprocess.on('error', (error: unknown) => {
            for (const callback of errorCallbacks) {
                callback(
                    timeoutSignal?.aborted === true
                        ? new ExecutionError('Command timed out.', {
                            reason: ErrorReason.PRECONDITION,
                            cause: error,
                        })
                        : new ExecutionError(`Failed to run command: ${HelpfulError.formatCause(error)}`, {
                            cause: error,
                        }),
                );
            }
        });

        const output = new BufferedIterator<string>();

        subprocess.stdout.on('data', data => {
            output.push(data.toString());
        });

        subprocess.stderr.on('data', data => {
            output.push(data.toString());
        });

        let exitCode: number | null = null;
        const exitListeners: ExitCallback[] = [];

        subprocess.on('exit', code => {
            output.close();
            exitCode = code ?? 1;

            for (const listener of exitListeners) {
                listener(exitCode);
            }
        });

        return {
            output: output,
            get running(): boolean {
                return exitCode === null;
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
                if (exitCode !== null) {
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
                if (exitCode !== null) {
                    resolve(exitCode);

                    return;
                }

                errorCallbacks.push(reject);

                subprocess.on('exit', code => {
                    resolve(code ?? 1);
                });
            }),
            kill: signal => new Promise<void>((resolve, reject) => {
                if (exitCode !== null) {
                    resolve();

                    return;
                }

                subprocess.stdout.destroy();
                subprocess.stderr.destroy();
                subprocess.stdin.destroy();

                if (subprocess.kill(signal)) {
                    resolve();
                    exitCode = 1;
                } else {
                    reject(new ExecutionError('Failed to kill the subprocess.'));
                }
            }),
        };
    }

    public runSync(command: Command, options: ExecutionOptions = {}): ExecutionResult {
        const timeoutSignal = options.timeout !== undefined
            ? AbortSignal.timeout(options.timeout)
            : undefined;

        const subprocess = spawnSync(command.name, command.arguments, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: options?.workingDirectory ?? this.currentDirectory?.get(),
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
}
