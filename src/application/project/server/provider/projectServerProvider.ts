import {Server} from '@/application/project/server/server';
import {Provider, ProviderError} from '@/application/provider/provider';
import {PackageManager} from '@/application/project/packageManager/packageManager';
import {ServerFactory, ServerInfo} from '@/application/project/server/factory/serverFactory';

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
