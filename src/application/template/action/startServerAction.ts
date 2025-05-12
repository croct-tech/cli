import {randomUUID} from 'node:crypto';
import {Action} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {Notifier} from '@/application/cli/io/output';
import {HelpfulError} from '@/application/error';
import {ServerFactory} from '@/application/project/server/factory/serverFactory';
import {Provider} from '@/application/provider/provider';
import {Server} from '@/application/project/server/server';
import {PackageManager} from '@/application/project/packageManager/packageManager';

type ServerInfo = {
    script: string,
    arguments?: string[],
    url: string,
};

export type StartServerOptions = {
    server?: ServerInfo,
    result?: {
        id?: string,
        url?: string,
    },
};

export type Configuration = {
    serverFactory: ServerFactory,
    packageManager: PackageManager,
    serverProvider: Provider<Server|null>,
    serverMap: Map<string, Server>,
};

type ServerInstance = {
    id?: string,
    url: URL,
    owned: boolean,
};

export class StartServer implements Action<StartServerOptions> {
    private readonly factory: ServerFactory;

    private readonly provider: Provider<Server|null>;

    private readonly packageManager: PackageManager;

    private readonly serverMap: Map<string, Server>;

    public constructor({serverFactory, serverProvider, packageManager, serverMap}: Configuration) {
        this.factory = serverFactory;
        this.provider = serverProvider;
        this.packageManager = packageManager;
        this.serverMap = serverMap;
    }

    public async execute(options: StartServerOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output.notify('Checking server');

        let instance: ServerInstance;

        try {
            instance = await this.startServer(notifier, options.server);
        } finally {
            notifier.stop();
        }

        if (options.result?.url !== undefined) {
            context.set(options.result.url, instance.url.toString());
        }

        if (options.result?.id !== undefined) {
            context.set(options.result.id, instance.id ?? null);
        }
    }

    private async startServer(notifier: Notifier, info?: ServerInfo): Promise<ServerInstance> {
        const server = await this.getServer(info);
        const status = await server.getStatus();

        if (status.running) {
            return {
                url: status.url,
                owned: false,
            };
        }

        notifier.update('Starting server');

        const id = randomUUID();

        this.serverMap.set(id, server);

        return {
            id: id,
            url: await server.start(),
            owned: true,
        };
    }

    private async getServer(info?: ServerInfo): Promise<Server> {
        if (info === undefined) {
            const server = await this.provider.get();

            if (server === null) {
                throw new HelpfulError('No server detected.');
            }

            return server;
        }

        const url = new URL(info.url);

        return this.factory.create({
            host: url.hostname,
            protocol: url.protocol === 'https:' ? 'https' : 'http',
            defaultPort: url.port === '' ? 80 : Number.parseInt(url.port, 10),
            command: await this.packageManager.getScriptCommand(info.script, info.arguments),
        });
    }
}
