/* eslint-disable no-param-reassign -- Intentional */
import cliCursor from 'cli-cursor';
import chalk from 'chalk';
import {Writable} from 'stream';
import readline from 'node:readline';
import {WriteStream} from 'tty';
import stripAnsi from 'strip-ansi';
import {Task, TaskList, TaskOptions, Notifier, Semantics} from '@/application/cli/io/output';
import {format} from '@/infrastructure/application/cli/io/formatting';
import {TaskExecution, TaskMonitor} from '@/infrastructure/application/cli/io/taskMonitor';

type TaskStatus = 'loading' | 'pending' | 'error' | 'warning' | 'success';

type TaskInfo = {
    title?: string,
    subtitle?: string,
    status: TaskStatus,
};

type TaskState = Omit<TaskInfo, 'title'> & Required<Pick<TaskInfo, 'title'>> & {
    task: Task['task'],
};

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    .map(frame => chalk.cyan(frame));

type StopCallback = (watcher: TaskWatcher) => void;

type TaskWatcherOptions = TaskOptions & {
    manual?: boolean,
    status?: TaskStatus,
    onStop?: StopCallback,
};

class TaskWatcher {
    private readonly output: Writable;

    private readonly tasks: TaskState[] = [];

    private readonly options: TaskWatcherOptions;

    private interval: NodeJS.Timeout | null = null;

    private promise: Promise<void> | null = null;

    private active = false;

    private frame: number = 0;

    private lineCount: number = 0;

    public constructor(tasks: TaskList['tasks'], output: Writable, options: TaskWatcherOptions = {}) {
        this.output = output;
        this.options = options;
        this.tasks = tasks.map(
            task => ({
                title: task.title,
                subtitle: task.subtitle,
                status: options.status ?? 'pending',
                task: task.task,
            }),
        );
    }

    public suspend(): void {
        if (this.active) {
            this.stopRendering(true);
            cliCursor.show();
        }
    }

    public stop(persist?: boolean): void {
        if (this.active) {
            this.active = false;
            this.stopRendering(persist !== undefined ? !persist : this.options.clear === true);
            cliCursor.show();
            this.options.onStop?.(this);
        }
    }

    public start(): Promise<void> {
        if (this.promise !== null && !this.active) {
            return this.promise;
        }

        if (this.promise === null) {
            this.active = true;
            this.promise = this.execute();
        }

        if (this.active) {
            cliCursor.hide();
            this.resumeRendering();
        }

        return this.promise;
    }

    private async execute(): Promise<void> {
        try {
            await (
                this.options.concurrent === true
                    ? Promise.all(this.tasks.map(task => this.startTask(task)))
                    : this.tasks.reduce(
                        (promise, task) => promise.then(() => this.startTask(task)),
                        Promise.resolve(),
                    )
            );

            if (this.options.manual !== true) {
                this.stop();
            }
        } catch (error) {
            this.stop();

            throw error;
        }
    }

    private startTask(task: TaskState): Promise<void> {
        this.updateTask(task, {status: 'loading'});

        return task.task({
            confirm: (status, details) => this.updateTask(task, {
                status: 'success',
                title: status,
                subtitle: details,
            }),
            alert: (status, details) => this.updateTask(task, {
                status: 'error',
                title: status,
                subtitle: details,
            }),
            warn: (status, details) => this.updateTask(task, {
                status: 'warning',
                title: status,
                subtitle: details,
            }),
            update: (status, details) => this.updateTask(task, {
                status: 'loading',
                title: status,
                subtitle: details,
            }),
        });
    }

    public setStatus(taskIndex: number, info: TaskInfo): void {
        if (!this.active) {
            throw new Error('Cannot update task status once the task is finished');
        }

        this.updateTask(this.tasks[taskIndex], info);
    }

    private updateTask(task: TaskState, info: TaskInfo): void {
        task.status = info.status;

        if (info.title !== undefined) {
            task.title = info.title;
        }

        task.subtitle = info.subtitle;
    }

    private stopRendering(clear: boolean): void {
        if (this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
            this.clear();

            if (!clear) {
                // Make sure the last frame is rendered
                this.render();
            }
        }
    }

    private resumeRendering(): void {
        this.render();

        this.interval = setInterval(
            () => {
                this.frame++;
                this.render(true);
            },
            80,
        );

        this.interval.unref();
    }

    private clear(): void {
        for (let index = 0; index < this.lineCount; index++) {
            readline.moveCursor(this.output, 0, -1);
            readline.clearLine(this.output, 0);
        }

        this.lineCount = 0;
    }

    private render(autoClear = false): void {
        const terminalWidth = this.output instanceof WriteStream
            ? this.output.columns
            : 0;

        const lines: string[] = [];

        let lineCount = 0;

        for (const task of this.tasks) {
            const line = this.formatTask(task);

            const wrappedLines = line.split('\n')
                .map(subLine => (terminalWidth === 0 ? 1 : Math.ceil([...stripAnsi(subLine)].length / terminalWidth)));

            lineCount = wrappedLines.reduce((sum, count) => sum + count, lineCount);
            lines.push(`${line}${autoClear ? '\x1b[0K' : ''}\n`);
        }

        if (autoClear && this.lineCount > lineCount) {
            this.clear();
        } else {
            readline.moveCursor(this.output, 0, -this.lineCount);
        }

        for (const line of lines) {
            this.output.write(line);
        }

        this.lineCount = lineCount;
    }

    private formatTask(task: TaskState): string {
        const semantics = TaskWatcher.getSemantics(task.status);
        let message = task.status === 'loading'
            ? `${spinnerFrames[this.frame % spinnerFrames.length]} ${format(task.title)}`
            : format(task.title, {
                icon: {
                    semantics: semantics,
                    symbol: task.status === 'pending'
                        ? {
                            unicode: '◷',
                            ascii: '■',
                        }
                        : undefined,
                },
            });

        if (task.subtitle !== undefined) {
            message += `\n${format(task.subtitle, {
                text: 'secondary',
                icon: {
                    semantics: 'secondary',
                },
            })}`;
        }

        return message;
    }

    private static getSemantics(status: TaskStatus): Semantics {
        return status === 'loading' || status === 'pending' ? 'neutral' : status;
    }
}

export class InteractiveTaskMonitor implements TaskMonitor {
    private readonly output: Writable;

    private readonly watchers: TaskWatcher[] = [];

    public constructor(output: Writable) {
        this.output = output;
    }

    public suspend(): void {
        for (const task of this.watchers) {
            task.suspend();
        }
    }

    public stop(persist?: boolean): void {
        for (const task of this.watchers) {
            task.stop(persist);
        }
    }

    public resume(): void {
        this.watchers[this.watchers.length - 1]?.start();
    }

    public notify(initialStatus: string): Notifier {
        const watcher = this.addWatcher(
            {
                tasks: [{
                    title: initialStatus,
                    task: () => Promise.resolve(),
                }],
            },
            {
                manual: true,
                status: 'loading',
            },
        );

        watcher.start();

        return {
            stop: (persist = false): void => {
                watcher.stop(persist);
            },
            update: (status, details): void => {
                watcher.setStatus(0, {
                    status: 'loading',
                    title: status,
                    subtitle: details,
                });
            },
            confirm: (status, details): void => {
                watcher.setStatus(0, {
                    status: 'success',
                    title: status,
                    subtitle: details,
                });
                watcher.stop(true);
            },
            alert: (status, details): void => {
                watcher.setStatus(0, {
                    status: 'error',
                    title: status,
                    subtitle: details,
                });
                watcher.stop(true);
            },
            warn: (status, details): void => {
                watcher.setStatus(0, {
                    status: 'warning',
                    title: status,
                    subtitle: details,
                });
                watcher.stop(true);
            },
        };
    }

    public monitor(tasks: TaskList): TaskExecution {
        const watcher = this.addWatcher(tasks);
        const execution = watcher.start();

        return {
            wait: () => execution,
            stop: () => watcher.stop(),
        };
    }

    private addWatcher(tasks: TaskList, options: TaskWatcherOptions = {}): TaskWatcher {
        for (const task of this.watchers) {
            task.suspend();
        }

        const watcher = new TaskWatcher(tasks.tasks, this.output, {
            clear: tasks.clear,
            concurrent: tasks.concurrent,
            ...options,
            onStop: instance => this.removeWatcher(instance),
        });

        this.watchers.push(watcher);

        return watcher;
    }

    private removeWatcher(watcher: TaskWatcher): void {
        const index = this.watchers.indexOf(watcher);
        const isCurrent = index === this.watchers.length - 1;

        this.watchers.splice(index, 1);

        if (isCurrent) {
            this.resume();
        }
    }
}
