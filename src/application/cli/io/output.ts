export type SpinnerFlowOptions = {
    duration?: number,
    loop?: boolean,
};

export type Spinner = {
    start(status: string): Spinner,
    flow(statuses: string[], options?: SpinnerFlowOptions): Spinner,
    stop(persist?: boolean): void,
    update(status: string): Spinner,
    succeed(status?: string): Spinner,
    fail(status?: string): Spinner,
    warn(status?: string): Spinner,
};

export interface Logger {
    log(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    success(message: string): void;
}

export interface Output extends Logger {
    createSpinner(status?: string): Spinner;
    reportError(error: any): void;
    open(url: string): Promise<void>;
    exit(): never;
}
