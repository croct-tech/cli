import {IPtyForkOptions, IWindowsPtyForkOptions, spawn} from 'node-pty';
import {BufferedIterator} from '@/infrastructure/bufferedIterator';
import {
    CommandExecutor,
    DisposableListener,
    Execution,
    ExecutionError,
    ExecutionOptions,
    ExitCallback,
} from '@/application/system/process/executor';
import {ErrorReason} from '@/application/error';
import {Command} from '@/application/system/process/command';

export type Configuration = IPtyForkOptions | IWindowsPtyForkOptions;

export class PtyExecutor implements CommandExecutor {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration = {}) {
        this.configuration = configuration;
    }

    public run(command: Command, options: ExecutionOptions = {}): Execution {
        const subprocess = spawn(command.name, command.arguments ?? [], {
            ...this.configuration,
            cwd: options.workingDirectory ?? this.configuration.cwd,
        });

        const output = new BufferedIterator<string>();

        subprocess.onData(data => output.push(data));

        let timeout: ReturnType<typeof setTimeout> | undefined;

        let exitCode: number|null = null;

        let timedOut = false;

        if (options.timeout !== undefined) {
            timeout = setTimeout(
                () => {
                    if (exitCode === null) {
                        subprocess.kill('SIGINT');
                        timedOut = true;
                    }
                },
                options.timeout,
            );

            timeout.unref();
        }

        const exitListeners: ExitCallback[] = [];

        subprocess.onExit(result => {
            output.close();
            exitCode = result.exitCode;

            for (const listener of exitListeners) {
                listener(result.exitCode);
            }
        });

        return {
            output: output,
            get running(): boolean {
                return exitCode === null;
            },
            read: async (): Promise<string> => {
                let data = '';

                for await (const chunk of output) {
                    data += chunk;
                }

                return data;
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
            write: (data: string): Promise<void> => {
                subprocess.write(data);

                return Promise.resolve();
            },
            wait: (): Promise<number> => {
                if (timedOut) {
                    return Promise.reject(
                        new ExecutionError('Command timed out.', {
                            reason: ErrorReason.PRECONDITION,
                        }),
                    );
                }

                if (exitCode !== null) {
                    return Promise.resolve(exitCode);
                }

                return new Promise<number>(resolve => {
                    subprocess.onExit(result => {
                        resolve(result.exitCode);
                    });
                });
            },
            kill: (signal): Promise<void> => {
                if (timeout !== undefined) {
                    clearTimeout(timeout);
                }

                if (exitCode !== null) {
                    return Promise.resolve();
                }

                const promise = new Promise<void>(resolve => {
                    subprocess.onExit(() => {
                        resolve();
                    });
                });

                subprocess.kill(signal);

                return promise;
            },
        };
    }
}
