import {ServerFactory, ServerConfiguration} from '@/application/project/server/provider/projectServerProvider';
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

    private static getServerId({command, ...configuration}: ServerConfiguration): string {
        const url = new URL(`${configuration.protocol}://${configuration.host}`);

        url.port = `${configuration.port ?? configuration.defaultPort}`;
        url.searchParams.set('command', command.name);

        if (command.arguments !== undefined && command.arguments.length > 0) {
            url.searchParams.set('args', command.arguments.join(','));
        }

        return url.toString();
    }
}
