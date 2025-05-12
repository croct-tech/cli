import {Action} from '@/application/template/action/action';
import {Server} from '@/application/project/server/server';
import {ActionContext} from '@/application/template/action/context';
import {HelpfulError} from '@/application/error';

export type StopServerOptions = {
    id: string,
};

export type Configuration = {
    serverMap: Map<string, Server>,
};

export class StopServer implements Action<StopServerOptions> {
    private readonly serverMap: Map<string, Server>;

    public constructor({serverMap}: Configuration) {
        this.serverMap = serverMap;
    }

    public async execute({id}: StopServerOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const server = this.serverMap.get(id);

        if (server === undefined) {
            throw new HelpfulError(`No server with id "${id}" found.`);
        }

        const notifier = output.notify('Stopping server');

        try {
            await server.stop();
        } finally {
            notifier.stop();
        }

        this.serverMap.delete(id);
    }
}
