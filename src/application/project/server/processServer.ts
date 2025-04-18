import {Server, ServerError, ServerStatus} from '@/application/project/server/server';
import {CommandExecutor, Execution} from '@/application/system/process/executor';
import {Command} from '@/application/system/process/command';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';

import {ProcessObserver} from '@/application/system/process/process';

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

    public async start(): Promise<URL> {
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

        const callback = (): Promise<void> => this.stop();

        this.execution.onExit(() => {
            this.execution = undefined;
            processObserver.off('exit', callback);
        });

        if (!this.execution.running) {
            throw new ServerError('Failed to start server.');
        }

        processObserver.on('exit', callback);

        const url = await this.waitStart();

        if (url === null) {
            throw new ServerError('Server is unreachable.');
        }

        return url;
    }

    public async stop(): Promise<void> {
        await this?.execution?.kill('SIGINT');

        this.execution = undefined;
    }

    private async waitStart(): Promise<URL | null> {
        const {startupCheckDelay, startupTimeout} = this.configuration;
        const controller = new AbortController();

        const timer = setTimeout(() => controller.abort(), startupTimeout);

        timer.unref();

        const delay = (): Promise<void> => new Promise(resolve => {
            setTimeout(resolve, startupCheckDelay);
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
