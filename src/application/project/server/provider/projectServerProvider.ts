import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';
import {Server} from '@/application/project/server/server';
import {ProviderError} from '@/application/provider/provider';

export type ServerConfiguration = {
    protocol: string,
    host: string,
    port?: number,
    defaultPort: number,
    command: {
        name: string,
        args: string[],
    },
};

export type ServerFactory = {
    create(configuration: ServerConfiguration): Server,
};

export interface ServerCommandParser {
    parse(script: string, command: string): Promise<ServerConfiguration|null>;
}

export type Configuration = {
    scriptProvider: ParameterlessProvider<Record<string, string>>,
    factory: ServerFactory,
    parsers: ServerCommandParser[],
};

export class ProjectServerProvider implements ParameterlessProvider<Server> {
    private readonly factory: ServerFactory;

    private readonly scriptProvider: ParameterlessProvider<Record<string, string>>;

    private readonly parsers: ServerCommandParser[];

    public constructor({factory, scriptProvider, parsers}: Configuration) {
        this.factory = factory;
        this.scriptProvider = scriptProvider;
        this.parsers = parsers;
    }

    public async get(): Promise<Server> {
        const scripts = await this.scriptProvider.get();

        for (const [name, command] of Object.entries(scripts)) {
            for (const parser of this.parsers) {
                const configuration = await parser.parse(name, command);

                if (configuration !== null) {
                    return this.factory.create(configuration);
                }
            }
        }

        throw new ProviderError('No server found.');
    }
}
