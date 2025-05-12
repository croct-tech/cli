import {Server} from '@/application/project/server/server';
import {Command} from '@/application/system/process/command';

export type ServerInfo = {
    protocol: string,
    host: string,
    port?: number,
    defaultPort: number,
};

export type ServerConfiguration = ServerInfo & {
    command: Command,
};

export interface ServerFactory {
    create(configuration: ServerConfiguration): Promise<Server>;
}
