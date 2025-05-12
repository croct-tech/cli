import {Server} from '@/application/project/server/server';
import {Configuration as ProcessServerConfiguration, ProcessServer} from '@/application/project/server/processServer';
import {ServerConfiguration, ServerFactory} from '@/application/project/server/factory/serverFactory';

export type Configuration = Omit<ProcessServerConfiguration, 'command' | 'server'>;

export class ProcessServerFactory implements ServerFactory {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public create(configuration: ServerConfiguration): Promise<Server> {
        return Promise.resolve(
            new ProcessServer({
                ...this.configuration,
                command: configuration.command,
                server: {
                    protocol: configuration.protocol,
                    host: configuration.host,
                    defaultPort: configuration.defaultPort,
                    port: configuration.port,
                },
            }),
        );
    }
}
