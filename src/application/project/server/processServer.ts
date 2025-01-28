import {ChildProcess, spawn} from 'child_process';
import {Server, ServerStatus} from '@/application/project/server/server';

export type Configuration = {
    command: string,
    args: string[],
    startupCheckDelay: number,
    startupTimeout: number,
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

    private subprocess?: ChildProcess;

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
        await new Promise<void>((resolve, reject) => {
            this.subprocess = spawn(this.configuration.command, this.configuration.args, {
                cwd: this.configuration.currentDirectory,
                stdio: 'ignore',
            });

            this.subprocess.on('error', reject);

            this.subprocess.on('exit', code => {
                reject(new Error(`Server exited with code ${code}.`));
            });

            if (this.subprocess.pid === undefined) {
                reject(new Error('Server did not start.'));

                return;
            }

            resolve();
        });

        const url = await this.waitStart();

        if (url === null) {
            throw new Error('Server is unreachable.');
        }

        return url;
    }

    public stop(): Promise<void> {
        const {subprocess} = this;

        if (subprocess === undefined) {
            return Promise.resolve();
        }

        return new Promise<void>(resolve => {
            subprocess.on('exit', () => {
                this.subprocess = undefined;

                resolve();
            });

            subprocess.kill('SIGINT');
        });
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
