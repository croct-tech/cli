import open from 'open';
import chalk from 'chalk';
import boxen from 'boxen';
import terminalLink from 'terminal-link';
import {Writable, PassThrough} from 'stream';
import {Output, Notifier, TaskList, TaskResolver} from '@/application/cli/io/output';
import {CliError, CliErrorCode, CliHelp} from '@/application/cli/error';
import {InteractiveTaskMonitor} from '@/infrastructure/application/cli/io/interactiveTaskMonitor';
import {format} from '@/infrastructure/application/cli/io/formatting';
import {TaskMonitor} from '@/infrastructure/application/cli/io/taskMonitor';
import {NonInteractiveTaskMonitor} from '@/infrastructure/application/cli/io/nonInteractiveTaskMonitor';

export type ExitCallback = () => never;

export type Configuration = {
    output: Writable,
    onExit: ExitCallback,
    quiet?: boolean,
    interactive?: boolean,
};

export class ConsoleOutput implements Output {
    private readonly output: Writable;

    private readonly onExit: ExitCallback;

    private readonly quiet: boolean;

    private taskMonitor: TaskMonitor;

    public constructor({output, onExit, quiet = false, interactive = true}: Configuration) {
        this.output = output;
        this.onExit = onExit;
        this.quiet = quiet;
        this.taskMonitor = interactive && !quiet
            ? new InteractiveTaskMonitor(output)
            : new NonInteractiveTaskMonitor(quiet ? new PassThrough() : output);
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
        await open(target);
    }

    public break(): void {
        this.stop();
        this.write('\n');
    }

    public log(text: string): void {
        this.stop();
        this.write(`${format(text)}\n`);
    }

    public confirm(text: string): void {
        this.stop();
        this.write(`${format(text, {icon: {semantic: 'success'}})}\n`);
    }

    public inform(text: string): void {
        this.stop();
        this.write(`${format(text, {icon: {semantic: 'info'}})}\n`);
    }

    public warn(text: string): void {
        this.stop();
        this.write(`${format(text, {icon: {semantic: 'warning'}})}\n`);
    }

    public alert(text: string): void {
        this.stop();
        this.write(`${format(text, {icon: {semantic: 'error'}})}\n`);
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
        this.write(`${this.formatError(error)}\n`, true);
    }

    public exit(): never {
        this.stop();
        this.onExit();
    }

    private formatError(error: any): string {
        let message = format(CliError.formatMessage(error));

        const usefulLinks: CliHelp['links'] = [
            {
                description: 'Documentation',
                link: 'https://docs.croct.io/sdk/cli',
            },
        ];

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

            if (error.code === CliErrorCode.OTHER) {
                usefulLinks.push({
                    description: 'Report this issue',
                    link: 'https://github.com/croct-tech/croct-cli/issues/new',
                });
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

        if (error instanceof Error && (!(error instanceof CliError) || error.code === CliErrorCode.OTHER)) {
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

    private write(text: string, critical = false): void {
        if (!this.quiet || critical) {
            this.output.write(text);
        }
    }
}
