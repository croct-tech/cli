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
} from '@/application/process/executor';
import {BufferedIterator} from '@/infrastructure/bufferedIterator';
import {ErrorReason} from '@/application/error';
import {WorkingDirectory} from '@/application/fs/workingDirectory';
import {Command} from '@/application/process/command';

export type Configuration = {
    currentDirectory?: WorkingDirectory,
};

export class SpawnExecutor implements CommandExecutor, SynchronousCommandExecutor {
    private readonly currentDirectory?: WorkingDirectory;

    public constructor({currentDirectory}: Configuration = {}) {
        this.currentDirectory = currentDirectory;
    }

    public run(command: Command, options: ExecutionOptions = {}): Execution {
        const timeoutSignal = options.timeout !== undefined
            ? AbortSignal.timeout(options.timeout)
            : undefined;

        const subprocess = spawn(command.name, command.arguments, {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: options?.workingDirectory ?? this.currentDirectory?.get(),
            signal: timeoutSignal,
        });

        subprocess.on('error', error => {
            if (timeoutSignal?.aborted === true) {
                throw new ExecutionError('Command timed out.', {
                    reason: ErrorReason.PRECONDITION,
                });
            }

            throw new ExecutionError('Failed to run command.', {
                cause: error,
            });
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
            wait: () => new Promise<number>(resolve => {
                if (exitCode !== null) {
                    resolve(exitCode);

                    return;
                }

                subprocess.on('exit', code => {
                    resolve(code ?? 1);
                });
            }),
            kill: signal => new Promise<void>((resolve, reject) => {
                if (exitCode !== null) {
                    resolve();

                    return;
                }

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

            throw new ExecutionError('Failed to run command.', {
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
