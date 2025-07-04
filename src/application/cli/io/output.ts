import {Callout} from '@/application/cli/io/logFormatter';

export type Notifier = {
    stop(persist?: boolean): void,
    update(status: string, details?: string): void,
    confirm(status?: string, details?: string): void,
    warn(status?: string, details?: string): void,
    alert(status?: string, details?: string): void,
};

export type TaskNotifier = {
    update(status: string, details?: string): void,
    confirm(status?: string, details?: string): void,
    warn(status?: string, details?: string): void,
    alert(status?: string, details?: string): void,
};

export type Task = {
    title: string,
    subtitle?: string,
    task: (notifier: TaskNotifier) => Promise<void>,
};

export type TaskOptions = {
    clear?: boolean,
    concurrent?: boolean,
};

export type TaskResolver<T> = (resolve: (value: T) => void, reject: (error: any) => void) => TaskList;

export type TaskList = TaskOptions & {
    tasks: Task[],
};

export type Semantics = 'neutral' | 'info' | 'error' | 'warning' | 'success' | 'secondary';

export interface Output {
    announce(callout: Callout): void;
    log(message: string, semantics?: Semantics): void;
    inform(message: string): void;
    warn(message: string): void;
    alert(message: string): void;
    confirm(message: string): void;
    debug(message: string): void;
    break(): void;
    monitor<T>(resolver: TaskResolver<T>): Promise<T>;
    monitor(tasks: TaskList): Promise<void>;
    notify(status: string): Notifier;
    report(error: any): void;
    open(url: string): Promise<void>;
    exit(): Promise<never>;
}
