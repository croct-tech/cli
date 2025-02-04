import {Action} from '@/application/template/action/action';
import {Server} from '@/application/project/server/server';
import {ActionContext} from '@/application/template/action/context';
import {Notifier} from '@/application/cli/io/output';
import {Provider} from '@/application/provider/provider';
import {HelpfulError} from '@/application/error';

export type StartServerOptions = {
    result?: {
        url?: string,
        owned?: string,
    },
};

export type Configuration = {
    serverProvider: Provider<Server|null>,
};

type ServerInstance = {
    url: URL,
    owned: boolean,
};

export class StartServer implements Action<StartServerOptions> {
    private readonly provider: Provider<Server|null>;

    public constructor({serverProvider}: Configuration) {
        this.provider = serverProvider;
    }

    public async execute(options: StartServerOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output.notify('Checking server');

        let instance: ServerInstance;

        try {
            instance = await this.startServer(notifier);
        } finally {
            notifier.stop();
        }

        if (options.result?.url !== undefined) {
            context.set(options.result.url, instance.url.toString());
        }

        if (options.result?.owned !== undefined) {
            context.set(options.result.owned, instance.owned);
        }
    }

    private async startServer(notifier: Notifier): Promise<ServerInstance> {
        const server = await this.provider.get();

        if (server === null) {
            throw new HelpfulError('No server detected.');
        }

        const status = await server.getStatus();

        if (status.running) {
            return {
                url: status.url,
                owned: false,
            };
        }

        notifier.update('Starting server');

        return {
            url: await server.start(),
            owned: true,
        };
    }
}
