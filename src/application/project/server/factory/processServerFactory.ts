import {ServerFactory, ServerConfiguration} from '@/application/project/server/provider/projectServerProvider';
import {Server} from '@/application/project/server/server';
import {Configuration as ProcessServerConfiguration, ProcessServer} from '@/application/project/server/processServer';

export type Configuration = Omit<ProcessServerConfiguration, 'command' | 'server'>;

export class ProcessServerFactory implements ServerFactory {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public create(configuration: ServerConfiguration): Server {
        return new ProcessServer({
            ...this.configuration,
            command: configuration.command,
            server: {
                protocol: configuration.protocol,
                host: configuration.host,
                defaultPort: configuration.defaultPort,
                port: configuration.port,
            },
        });
    }
}
