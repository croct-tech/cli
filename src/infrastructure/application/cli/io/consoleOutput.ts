import open from 'open';
import chalk from 'chalk';
import boxen from 'boxen';
import terminalLink from 'terminal-link';
import {Writable} from 'stream';
import {Output, Notifier, TaskList, TaskResolver} from '@/application/cli/io/output';
import {CliError, CliHelp} from '@/application/cli/error';
import {TaskMonitor} from '@/infrastructure/application/cli/io/taskMonitor';
import {format} from '@/infrastructure/application/cli/io/formatting';

export type ExitCallback = () => never;

export type Configuration = {
    output: Writable,
    onExit: ExitCallback,
};

export class ConsoleOutput implements Output {
    private readonly output: Writable;

    private readonly onExit: ExitCallback;

    private taskMonitor: TaskMonitor;

    public constructor({output, onExit}: Configuration) {
        this.output = output;
        this.onExit = onExit;
        this.taskMonitor = new TaskMonitor(output);
    }

    public suspend(): void {
        this.taskMonitor.suspend();
    }

    public resume(): void {
        this.taskMonitor.resume();
    }

    public async open(target: string): Promise<void> {
        await open(target);
    }

    public break(): void {
        this.output.write('\n');
    }

    public log(text: string): void {
        this.output.write(`${format(text)}\n`);
    }

    public confirm(text: string): void {
        this.output.write(`${format(text, {icon: {semantic: 'success'}})}\n`);
    }

    public inform(text: string): void {
        this.output.write(`${format(text, {icon: {semantic: 'info'}})}\n`);
    }

    public warn(text: string): void {
        this.output.write(`${format(text, {icon: {semantic: 'warning'}})}\n`);
    }

    public alert(text: string): void {
        this.output.write(`${format(text, {icon: {semantic: 'error'}})}\n`);
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
        this.alert(`\n${this.formatError(error)}`);
    }

    public exit(): never {
        this.suspend();
        this.onExit();
    }

    private formatError(error: any): string {
        let message = CliError.formatMessage(error);

        const usefulLinks = [
            {
                description: 'Documentation',
                link: 'https://docs.croct.io/sdk/cli',
            },
            {
                description: 'Report this issue',
                link: 'https://github.com/croct-tech/croct-cli/issues/new',
            },
        ] satisfies CliHelp['links'];

        if (error instanceof CliError) {
            const {suggestions, links} = error.help;

            if (suggestions !== undefined) {
                if (suggestions.length === 1) {
                    message += `\n\n💡 ${format(suggestions[0])}`;
                } else {
                    message += `\n\n💡 ${chalk.bold('Suggestions:')}\n`;
                    message += suggestions.map(suggestion => `  • ${format(suggestion)}`)
                        .join('\n');
                }
            }

            if (links !== undefined) {
                usefulLinks.push(...links);
            }
        }

        message += `\n\n🔗 ${chalk.bold('Useful links')}\n`;
        message += usefulLinks.map(
            ({description, link}) => ` • ${terminalLink(description, link, {
                fallback: (text, url) => `${text}: ${url}`,
            })}`,
        )
            .join('\n');

        if (error instanceof Error) {
            message += `\n\n${chalk.bold('Details:')}\n`;
            message += error.stack ?? error.message;
        }

        return boxen(message, {
            title: 'Error',
            titleAlignment: 'center',
            padding: {
                top: 1,
                bottom: 1,
                right: 2,
                left: 2,
            },
            borderColor: 'red',
            borderStyle: 'round',
        });
    }
}
