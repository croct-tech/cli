import {Writable} from 'stream';
import {TaskList, Notifier} from '@/application/cli/io/output';
import {TaskExecution, TaskMonitor} from '@/infrastructure/application/cli/io/taskMonitor';
import {format, Semantic} from '@/infrastructure/application/cli/io/formatting';

type InternalNotifier = Notifier & {
    stopped: boolean,
    lastStatus: string,
    latestDetails?: string,
};

export class NonInteractiveTaskMonitor implements TaskMonitor {
    private readonly output: Writable;

    private notifiers: InternalNotifier[] = [];

    private stopped = false;

    public constructor(output: Writable) {
        this.output = output;
    }

    public suspend(): void {
        this.stop();
    }

    public stop(): void {
        this.notifiers.forEach(notifier => {
            // eslint-disable-next-line no-param-reassign -- Internal state
            notifier.stopped = true;
        });
    }

    public resume(): void {
        this.notifiers.forEach(notifier => {
            // eslint-disable-next-line no-param-reassign -- Internal state
            notifier.stopped = false;
        });
    }

    public monitor(tasks: TaskList): TaskExecution {
        const notifiers = tasks.tasks.map(task => this.notify(task.title, tasks.clear));

        const promise = tasks.concurrent === true
            ? Promise.all(tasks.tasks.map((task, index) => task.task(notifiers[index])))
            : tasks.tasks.reduce(
                (previous, task, index) => previous.then(() => task.task(notifiers[index])),
                Promise.resolve(),
            );

        return {
            stop: (): void => {
                notifiers.forEach(notifier => notifier.stop(false));
            },
            wait: () => promise.then(() => {}),
        };
    }

    public notify(initialStatus: string, clear = false): InternalNotifier {
        const stop = (title?: string, subtitle?: string, semantic?: Semantic, persist = !clear): void => {
            if (!this.stopped && !notifier.stopped && persist) {
                this.log(title ?? notifier.lastStatus, subtitle ?? notifier.latestDetails, semantic);
            }

            const index = this.notifiers.indexOf(notifier);

            if (index !== -1) {
                this.notifiers.splice(index, 1);
            }
        };

        const notifier: InternalNotifier = {
            stopped: false,
            lastStatus: initialStatus,
            latestDetails: undefined,
            stop: (persist = false): void => {
                stop(notifier.lastStatus, notifier.latestDetails, 'neutral', persist);
            },
            update: (status, details): void => {
                notifier.lastStatus = status ?? notifier.lastStatus;
                notifier.latestDetails = details;
            },
            confirm: (status, details): void => {
                stop(status, details, 'success');
            },
            alert: (status, details): void => {
                stop(status, details, 'error');
            },
            warn: (status, details): void => {
                stop(status, details, 'warning');
            },
        };

        this.notifiers.push(notifier);

        return notifier;
    }

    private log(title: string, subtitle?: string, semantic?: Semantic): void {
        this.output.write(`${this.format(title, subtitle, semantic)}\n`);
    }

    private format(title: string, subtitle?: string, semantic: Semantic = 'neutral'): string {
        let message = format(title, {
            icon: {
                semantic: semantic,
            },
        });

        if (subtitle !== undefined) {
            message += `\n${format(subtitle, {
                text: semantic,
                icon: {
                    semantic: semantic,
                    symbol: {
                        unicode: '↳',
                        ascii: '›',
                    },
                },
            })}`;
        }

        return message;
    }
}
