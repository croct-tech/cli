import {Server} from '@/application/project/server/server';
import {Command} from '@/application/system/process/command';
import {Help, HelpfulError} from '@/application/error';

export type ServerInfo = {
    protocol: string,
    host: string,
    port?: number,
    defaultPort: number,
};

export type ServerConfiguration = ServerInfo & {
    command: Command,
};

export class ServerFactoryError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, ServerFactoryError.prototype);
    }
}

export interface ServerFactory {
    create(configuration: ServerConfiguration): Promise<Server>;
}
