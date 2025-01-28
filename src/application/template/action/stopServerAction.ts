import {Action} from '@/application/template/action/action';
import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';
import {Server} from '@/application/project/server/server';
import {ActionContext} from '@/application/template/action/context';

export type StopServerOptions = Record<never, never>;

export type Configuration = {
    serverProvider: ParameterlessProvider<Server>,
};

export class StopServer implements Action<StopServerOptions> {
    private readonly provider: ParameterlessProvider<Server>;

    public constructor({serverProvider}: Configuration) {
        this.provider = serverProvider;
    }

    public async execute(_: StopServerOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output.notify('Stopping server');

        try {
            const server = await this.provider.get();

            await server.stop();
        } finally {
            notifier.stop();
        }
    }
}
