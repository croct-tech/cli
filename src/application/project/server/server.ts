import {Logger} from '@croct/logging';
import {Help, HelpfulError} from '@/application/error';

type RunningStatus = {
    running: true,
    url: URL,
};

type StoppedStatus = {
    running: false,
    url?: never,
};

export class ServerError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, ServerError.prototype);
    }
}

export type ServerStatus = RunningStatus | StoppedStatus;

export type StartServerOptions = {
    logger?: Logger,
};

export interface Server {
    getStatus(): Promise<ServerStatus>;

    start(options?: StartServerOptions): Promise<URL>;

    stop(options?: StartServerOptions): Promise<void>;
}
