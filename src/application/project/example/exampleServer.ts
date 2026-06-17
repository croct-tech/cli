import type {Input} from '@/application/cli/io/input';
import type {Output} from '@/application/cli/io/output';
import type {Provider} from '@/application/provider/provider';
import type {Server} from '@/application/project/server/server';
import {TaskProgressLogger} from '@/infrastructure/application/cli/io/taskProgressLogger';

/**
 * The dev server seen by examples while they present themselves.
 *
 * The detected server is resolved lazily, the first time an example asks to open a URL: if it is
 * running the developer is offered to open it; if it is stopped, to start it. A server started here
 * is kept alive ({@link close}) until the developer stops it with Ctrl+C. The example URL is always
 * reported for reference, whether or not it is opened.
 */
export class ExampleServer {
    private readonly provider: Provider<Server | null>;

    private readonly input: Input | undefined;

    private readonly output: Output;

    private resolved = false;

    private base?: URL;

    private shouldOpen = false;

    private owned?: Server;

    public constructor(provider: Provider<Server | null>, input: Input | undefined, output: Output) {
        this.provider = provider;
        this.input = input;
        this.output = output;
    }

    public async open(name: string, path: string): Promise<void> {
        await this.resolve();

        if (this.base === undefined) {
            this.output.inform(`Start your dev server, then open \`${path}\` to view the '${name}' example.`);

            return;
        }

        const url = new URL(path, this.base).toString();

        this.output.inform(`View the '${name}' example at ${url}`);

        if (this.shouldOpen) {
            await this.output.open(url);
        }
    }

    public async close(): Promise<void> {
        if (this.owned !== undefined) {
            this.output.inform(`Server running at ${this.base?.toString() ?? ''}. Press Ctrl+C to stop.`);

            // Keep the CLI in the foreground while the server it started serves requests; Ctrl+C
            // stops the server (and the CLI) the way any dev server is stopped.
            await this.owned.wait();
        }
    }

    private async resolve(): Promise<void> {
        if (this.resolved) {
            return;
        }

        this.resolved = true;

        const server = await this.provider.get();
        const status = await server?.getStatus();

        if (status?.running === true) {
            this.base = status.url;
            this.shouldOpen = this.input !== undefined
                && await this.input.confirm({message: 'Open the example in your browser?', default: true});

            return;
        }

        if (
            server !== null
            && this.input !== undefined
            && await this.input.confirm({message: 'Start the dev server and open the example?', default: true})
        ) {
            const url = await this.start(server);

            if (url !== undefined) {
                this.base = url;
                this.shouldOpen = true;
                this.owned = server;
            }
        }
    }

    private async start(server: Server): Promise<URL | undefined> {
        const notifier = this.output.notify('Starting the dev server');

        try {
            const url = await server.start({
                logger: new TaskProgressLogger({status: 'Starting the dev server', notifier: notifier}),
            });

            notifier.confirm('Dev server started');

            return url;
        } catch {
            notifier.stop();
            this.output.warn('Could not start the dev server. Start it manually, then open the example.');

            return undefined;
        }
    }
}
