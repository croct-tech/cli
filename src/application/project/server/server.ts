type RunningStatus = {
    running: true,
    url: URL,
};

type StoppedStatus = {
    running: false,
    url?: never,
};

export type ServerStatus = RunningStatus | StoppedStatus;

export interface Server {
    getStatus(): Promise<ServerStatus>;

    start(): Promise<URL>;

    stop(): Promise<void>;
}
