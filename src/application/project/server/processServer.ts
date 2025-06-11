import {LogLevel} from '@croct/logging';
import {Server, ServerError, ServerStatus, StartServerOptions} from '@/application/project/server/server';
import {CommandExecutor, Execution} from '@/application/system/process/executor';
import {Command} from '@/application/system/process/command';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';

import {ProcessObserver} from '@/application/system/process/process';
import {ScreenBuffer} from '@/application/cli/io/screenBuffer';

export type Configuration = {
    command: Command,
    commandExecutor: CommandExecutor,
    workingDirectory: WorkingDirectory,
    startupCheckDelay: number,
    startupTimeout: number,
    lookupTimeout: number,
    lookupMaxPorts: number,
    processObserver: ProcessObserver,
    server: {
        protocol: string,
        host: string,
        defaultPort: number,
        port?: number,
    },
};

export class ProcessServer implements Server {
    private readonly configuration: Configuration;

    private execution?: Execution;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public async getStatus(): Promise<ServerStatus> {
        const address = await this.findAddress();

        if (address === null) {
            return {running: false};
        }

        return {
            running: true,
            url: address,
        };
    }

    public async start({logger}: StartServerOptions = {}): Promise<URL> {
        const {commandExecutor, command, workingDirectory, processObserver} = this.configuration;

        try {
            this.execution = await commandExecutor.run(command, {
                workingDirectory: workingDirectory.get(),
            });
        } catch (error) {
            throw new ServerError('Failed to start server.', {
                cause: error,
            });
        }

        const abortController = new AbortController();

        const onExit = (): Promise<void> => {
            abortController.abort();

            return this.stop();
        };

        this.execution.onExit(() => {
            this.execution = undefined;
            processObserver.off('exit', onExit);
        });

        if (!this.execution.running) {
            throw new ServerError('Failed to start server.');
        }

        processObserver.on('exit', onExit);

        const {output} = this.execution;
        const buffer = new ScreenBuffer();

        const loggingLoop = (async (): Promise<void> => {
            for await (const line of output) {
                if (abortController.signal.aborted) {
                    return;
                }

                buffer.write(line);

                logger?.log({
                    level: LogLevel.DEBUG,
                    message: line,
                });
            }
        })();

        const url = await this.waitStart(abortController);

        abortController.abort();

        await loggingLoop;

        if (url === null) {
            logger?.log({
                level: LogLevel.ERROR,
                message: 'Unable to reach the server after it was started.',
            });

            const finalOutput = ScreenBuffer.getRawString(buffer.getSnapshot()).trim();

            throw new ServerError(`Server is unreachable${finalOutput === '' ? '.' : `:\n\n${finalOutput}`}`);
        }

        return url;
    }

    public async stop(): Promise<void> {
        await this.execution?.kill('SIGINT');

        this.execution = undefined;
    }

    private async waitStart(controller: AbortController): Promise<URL | null> {
        const {startupCheckDelay, startupTimeout} = this.configuration;

        const timer = setTimeout(() => controller.abort(), startupTimeout);

        timer.unref();

        controller.signal.addEventListener('abort', () => {
            clearTimeout(timer);
        });

        const delay = (): Promise<void> => new Promise(resolve => {
            const callback = (): void => {
                resolve();
                controller.signal.removeEventListener('abort', callback);
            };

            setTimeout(resolve, startupCheckDelay);

            controller.signal.addEventListener('abort', callback);
        });

        do {
            const address = await this.findAddress(controller);

            if (address !== null) {
                return address;
            }

            await delay();
        } while (!controller.signal.aborted);

        return null;
    }

    private async findAddress(parentController?: AbortController): Promise<URL | null> {
        const {
            lookupTimeout,
            lookupMaxPorts,
            server: {protocol, host, port: fixedPort, defaultPort},
        } = this.configuration;

        const startPort = fixedPort ?? defaultPort;
        const endPort = fixedPort ?? (defaultPort + lookupMaxPorts - 1);
        const controller = new AbortController();

        if (parentController !== undefined) {
            parentController.signal.addEventListener('abort', () => controller.abort());
        }

        const timer = setTimeout(() => controller.abort(), lookupTimeout);

        timer.unref();

        const address = new URL(`${protocol}://${host}`);

        for (let port = startPort; port <= endPort; port++) {
            try {
                address.port = port.toString();

                await fetch(address, {
                    method: 'HEAD',
                    signal: controller.signal,
                });

                return address;
            } catch {
                // Ignore
            }

            if (controller.signal.aborted) {
                break;
            }
        }

        return null;
    }
}
