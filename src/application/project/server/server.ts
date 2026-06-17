import type {Logger} from '@croct/logging';
import type {Help} from '@/application/error';
import {HelpfulError} from '@/application/error';

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

    /**
     * Resolves when the server process started by this instance exits.
     *
     * Resolves immediately when no process is running. Used to keep the CLI in the foreground while
     * a server it started serves requests, returning once it is stopped (e.g. with Ctrl+C).
     */
    wait(): Promise<void>;
}
