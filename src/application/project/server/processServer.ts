import {spawn} from 'child_process';
import {Server, ServerStatus, ServerInstance} from '@/application/project/server/server';

export type Configuration = {
    command: string,
    args: string[],
    startupCheckDelay: number,
    startupTimeout: number,
    commandTimeout: number,
    lookupTimeout: number,
    lookupMaxPorts: number,
    currentDirectory: string,
    server: {
        protocol: string,
        host: string,
        defaultPort: number,
        port?: number,
    },
};

export class ProcessServer implements Server {
    private readonly configuration: Configuration;

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

    public async start(): Promise<ServerInstance> {
        const callback = await new Promise<ServerInstance['stop']>((resolveStart, rejectStart) => {
            const subprocess = spawn(this.configuration.command, this.configuration.args, {
                cwd: this.configuration.currentDirectory,
                timeout: this.configuration.commandTimeout,
                stdio: 'ignore',
            });

            subprocess.on('error', rejectStart);

            subprocess.on('exit', code => {
                rejectStart(new Error(`Server exited with code ${code}`));
            });

            if (subprocess.pid === undefined) {
                rejectStart(new Error('Server did not start'));

                return;
            }

            resolveStart(
                () => new Promise(resolveStop => {
                    subprocess.on('exit', resolveStop);
                    subprocess.kill('SIGTERM');
                }),
            );
        });

        const url = await this.waitStart();

        if (url === null) {
            throw new Error('Server is unreachable');
        }

        return {
            url: url,
            stop: callback,
        };
    }

    private async waitStart(): Promise<URL|null> {
        const {startupCheckDelay, startupTimeout} = this.configuration;
        const controller = new AbortController();

        const timer = setTimeout(() => controller.abort(), startupTimeout);

        timer.unref();

        const delay = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, startupCheckDelay); });

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
