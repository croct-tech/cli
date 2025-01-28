import {ServerConfiguration, ServerFactory} from '@/application/project/server/provider/projectServerProvider';
import {Server} from '@/application/project/server/server';

export class CachedServerFactory implements ServerFactory {
    private readonly instances = new Map<string, Server>();

    private readonly factory: ServerFactory;

    public constructor(factory: ServerFactory) {
        this.factory = factory;
    }

    public create(configuration: ServerConfiguration): Server {
        const serverId = CachedServerFactory.getServerId(configuration);
        const instance = this.instances.get(serverId);

        if (instance !== undefined) {
            return instance;
        }

        const server = this.factory.create(configuration);

        this.instances.set(serverId, server);

        return server;
    }

    private static getServerId(configuration: ServerConfiguration): string {
        const url = new URL(`${configuration.protocol}://${configuration.host}`);

        url.port = `${configuration.port ?? configuration.defaultPort}`;
        url.searchParams.set('command', configuration.command.name);
        url.searchParams.set('args', configuration.command.args.join(','));

        return url.toString();
    }
}
