import {Help, HelpfulError} from '@/application/error';
import {Command} from '@/application/system/process/command';

export type Signal = NodeJS.Signals;

export class ExecutionError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, ExecutionError.prototype);
    }
}

export type DisposableListener = () => void;

export type ExitCallback = (exitCode: number) => void;

export interface Execution {
    running: boolean;
    output: AsyncIterable<string>;
    read(): Promise<string>;
    write(data: string): Promise<void>;
    wait(): Promise<number>;
    kill(signal?: Signal): Promise<void>;
    endWriting(): Promise<void>;
    onExit(callback: ExitCallback): DisposableListener;
}

export type ExecutionResult = {
    exitCode: number,
    output: string,
};

export type ExecutionOptions = {
    workingDirectory?: string,
    timeout?: number,
};

export interface CommandExecutor {
    run(command: Command, options?: ExecutionOptions): Promise<Execution>;
}

export interface SynchronousCommandExecutor {
    runSync(command: Command, options?: ExecutionOptions): ExecutionResult;
}
