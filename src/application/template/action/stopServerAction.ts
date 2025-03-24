import {Action} from '@/application/template/action/action';
import {Server} from '@/application/project/server/server';
import {ActionContext} from '@/application/template/action/context';
import {Provider} from '@/application/provider/provider';
import {HelpfulError} from '@/application/error';

export type StopServerOptions = Record<never, never>;

export type Configuration = {
    serverProvider: Provider<Server|null>,
};

export class StopServer implements Action<StopServerOptions> {
    private readonly provider: Provider<Server|null>;

    public constructor({serverProvider}: Configuration) {
        this.provider = serverProvider;
    }

    public async execute(_: StopServerOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output.notify('Stopping server');

        const server = await this.provider.get();

        if (server === null) {
            throw new HelpfulError('No server detected.');
        }

        try {
            await server.stop();
        } finally {
            notifier.stop();
        }
    }
}
