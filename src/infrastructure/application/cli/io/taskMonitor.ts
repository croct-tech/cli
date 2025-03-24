import {Notifier, TaskList} from '@/application/cli/io/output';

export type TaskExecution = {
    wait: () => Promise<void>,
    stop: () => void,
};

export interface TaskMonitor {
    suspend(): void;
    resume(): void;
    stop(persist?: boolean): void;
    monitor(tasks: TaskList): TaskExecution;
    notify(initialStatus: string): Notifier;
}
