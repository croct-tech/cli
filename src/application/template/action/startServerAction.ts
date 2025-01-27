import {Action} from '@/application/template/action/action';
import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';
import {Server} from '@/application/project/server/server';
import {ActionContext} from '@/application/template/action/context';
import {Notifier} from '@/application/cli/io/output';

export type StartServerOptions = {
    output?: {
        url?: string,
    },
};

export type Configuration = {
    serverProvider: ParameterlessProvider<Server>,
};

export class StartServer implements Action<StartServerOptions> {
    private readonly provider: ParameterlessProvider<Server>;

    public constructor({serverProvider}: Configuration) {
        this.provider = serverProvider;
    }

    public async execute(options: StartServerOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output.notify('Checking server');

        let url: URL;

        try {
            url = await this.startServer(notifier);
        } finally {
            notifier.stop();
        }

        if (options.output?.url !== undefined) {
            context.set(options.output.url, url.toString());
        }
    }

    private async startServer(notifier: Notifier): Promise<URL> {
        const server = await this.provider.get();

        const status = await server.getStatus();

        if (status.running) {
            return status.url;
        }

        notifier.update('Starting server');

        const instance = await server.start();

        return instance.url;
    }
}
