import {Server} from '@/application/project/server/server';
import {Provider, ProviderError} from '@/application/provider/provider';
import {Command} from '@/application/process/command';
import {PackageManager} from '@/application/project/packageManager/packageManager';

export type ServerInfo = {
    protocol: string,
    host: string,
    port?: number,
    defaultPort: number,
};

export type ServerConfiguration = ServerInfo & {
    command: Command,
};

export type ServerFactory = {
    create(configuration: ServerConfiguration): Server,
};

export interface ServerCommandParser {
    parse(command: string): ServerInfo|null;
}

export type Configuration = {
    factory: ServerFactory,
    packageManager: PackageManager,
    parsers: ServerCommandParser[],
};

export class ProjectServerProvider implements Provider<Server> {
    private readonly packageManager: PackageManager;

    private readonly parsers: ServerCommandParser[];

    private readonly factory: ServerFactory;

    public constructor({packageManager, parsers, factory}: Configuration) {
        this.packageManager = packageManager;
        this.parsers = parsers;
        this.factory = factory;
    }

    public async get(): Promise<Server> {
        const scripts = await this.packageManager.getScripts();

        for (const [script, command] of Object.entries(scripts)) {
            for (const parser of this.parsers) {
                const info = parser.parse(command);

                if (info !== null) {
                    return this.factory.create({
                        ...info,
                        command: await this.packageManager.getScriptCommand(script),
                    });
                }
            }
        }

        throw new ProviderError('No server found.');
    }
}
