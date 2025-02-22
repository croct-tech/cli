import {Writable, PassThrough} from 'stream';
import {Output, Notifier, TaskList, TaskResolver, Semantic} from '@/application/cli/io/output';
import {InteractiveTaskMonitor} from '@/infrastructure/application/cli/io/interactiveTaskMonitor';
import {format} from '@/infrastructure/application/cli/io/formatting';
import {TaskMonitor} from '@/infrastructure/application/cli/io/taskMonitor';
import {NonInteractiveTaskMonitor} from '@/infrastructure/application/cli/io/nonInteractiveTaskMonitor';
import {Callout, LogFormatter} from '@/application/cli/io/logFormatter';

export type ExitCallback = () => Promise<never>;

export type LinkOpener = (target: string) => Promise<void>;

export type Configuration = {
    output: Writable,
    formatter: LogFormatter,
    linkOpener: LinkOpener,
    onExit: ExitCallback,
    quiet?: boolean,
    interactive?: boolean,
};

export class ConsoleOutput implements Output {
    private readonly output: Writable;

    private readonly onExit: ExitCallback;

    private readonly quiet: boolean;

    private readonly formatter: LogFormatter;

    private readonly linkOpener: LinkOpener;

    private taskMonitor: TaskMonitor;

    public constructor(configuration: Configuration) {
        this.output = configuration.output;
        this.onExit = configuration.onExit;
        this.quiet = configuration.quiet ?? false;
        this.formatter = configuration.formatter;
        this.linkOpener = configuration.linkOpener;
        this.taskMonitor = (configuration.interactive ?? true) && !this.quiet
            ? new InteractiveTaskMonitor(this.output)
            : new NonInteractiveTaskMonitor(this.quiet ? new PassThrough() : this.output);
    }

    public suspend(): void {
        this.taskMonitor.suspend();
    }

    public resume(): void {
        this.taskMonitor.resume();
    }

    public stop(): void {
        this.taskMonitor.stop(false);
    }

    public async open(target: string): Promise<void> {
        await this.linkOpener(target);
    }

    public break(): void {
        this.write('\n');
    }

    public announce(callout: Callout): void {
        this.write(`${this.formatter.formatCallout(callout)}\n`);
    }

    public log(text: string, semantic?: Semantic): void {
        this.writeLog(text, semantic ?? 'neutral');
    }

    public confirm(text: string): void {
        this.writeLog(text, 'success');
    }

    public inform(text: string): void {
        this.writeLog(text, 'info');
    }

    public warn(text: string): void {
        this.writeLog(text, 'warning');
    }

    public alert(text: string): void {
        this.writeLog(text, 'error');
    }

    public notify(initialStatus: string): Notifier {
        return this.taskMonitor.notify(initialStatus);
    }

    public monitor<T>(resolver: TaskResolver<T>): Promise<T>;

    public monitor(tasks: TaskList): Promise<void>;

    public monitor<T>(tasks: TaskResolver<T> | TaskList): Promise<T | void> {
        if (typeof tasks === 'function') {
            return new Promise((resolve, reject) => {
                const execution = this.taskMonitor.monitor(tasks(resolve, (error: any) => {
                    execution.stop();
                    reject(error);
                }));
            });
        }

        return this.taskMonitor
            .monitor(tasks)
            .wait();
    }

    public report(error: any): void {
        this.stop();
        this.write(`${this.formatter.formatError(error)}\n`, true);
    }

    public exit(): Promise<never> {
        this.stop();

        return this.onExit();
    }

    private writeLog(text: string, semantic: Semantic): void {
        this.write(`${format(text, semantic === 'neutral' ? {} : {icon: {semantic: semantic}})}\n`);
    }

    private write(text: string, critical = false): void {
        if (!this.quiet || critical) {
            this.suspend();
            this.output.write(text);
            this.resume();
        }
    }
}
