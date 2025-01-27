type RunningStatus = {
    running: true,
    url: URL,
};

type StoppedStatus = {
    running: false,
    url?: never,
};

export type ServerStatus = RunningStatus | StoppedStatus;

export type ServerInstance = {
    url: URL,
    stop: () => Promise<void>,
};

export interface Server {
    getStatus(): Promise<ServerStatus>;

    start(): Promise<ServerInstance>;
}
