import open from 'open';
import chalk from 'chalk';
import boxen, {Options as BoxenOptions} from 'boxen';
import terminalLink from 'terminal-link';
import {Writable, PassThrough} from 'stream';
import {Output, Notifier, TaskList, TaskResolver} from '@/application/cli/io/output';
import {InteractiveTaskMonitor} from '@/infrastructure/application/cli/io/interactiveTaskMonitor';
import {format, Semantic} from '@/infrastructure/application/cli/io/formatting';
import {TaskMonitor} from '@/infrastructure/application/cli/io/taskMonitor';
import {NonInteractiveTaskMonitor} from '@/infrastructure/application/cli/io/nonInteractiveTaskMonitor';
import {HelpfulError, ErrorReason, Help} from '@/application/error';

export type ExitCallback = () => never;

export type Configuration = {
    output: Writable,
    onExit: ExitCallback,
    quiet?: boolean,
    interactive?: boolean,
};

const boxenStyle: BoxenOptions = {
    titleAlignment: 'center',
    padding: {
        top: 1,
        bottom: 1,
        right: 2,
        left: 2,
    },
    borderStyle: 'round',
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
        this.writeLog(text, 'neutral');
    }

    public confirm(text: string): void {
        this.stop();
        this.writeLog(text, 'success');
    }

    public inform(text: string): void {
        this.stop();
        this.writeLog(text, 'info');
    }

    public warn(text: string): void {
        this.stop();
        this.writeLog(text, 'warning');
    }

    public alert(text: string): void {
        this.stop();
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
        this.write(`${this.formatError(error)}\n`, true);
    }

    public exit(): never {
        this.stop();
        this.onExit();
    }

    private formatError(error: any): string {
        return boxen(ConsoleOutput.formatErrorBody(error), {
            ...boxenStyle,
            title: ConsoleOutput.formatErrorTitle(error),
            borderColor: 'red',
        });
    }

    private static formatErrorTitle(error: any): string {
        if (!(error instanceof HelpfulError)) {
            return 'Unexpected error';
        }

        const titles: Record<ErrorReason, string> = {
            [ErrorReason.INVALID_INPUT]: 'Invalid input',
            [ErrorReason.INVALID_CONFIGURATION]: 'Invalid configuration',
            [ErrorReason.PRECONDITION]: 'Precondition failed',
            [ErrorReason.ACCESS_DENIED]: 'Access denied',
            [ErrorReason.OTHER]: 'Error',
        };

        return titles[error.reason];
    }

    private static formatErrorBody(error: unknown): string {
        let body = format(HelpfulError.formatMessage(error));

        if (error instanceof HelpfulError) {
            const {cause} = error.help;

            if (cause !== undefined && error.message.toLowerCase() !== cause.message.toLowerCase()) {
                body += `\n\n${chalk.bold('Cause')}\n`;
                body += `${format(HelpfulError.formatMessage(error.help.cause))}`;
            }

            body += ConsoleOutput.formatErrorSuggestions(error);
            body += ConsoleOutput.formatErrorUsefulLinks(error);
        }

        body += ConsoleOutput.formatErrorDetails(error);

        return body;
    }

    private static formatErrorDetails(error: unknown): string {
        if (!(error instanceof HelpfulError)) {
            return ConsoleOutput.formatStackTrace(error);
        }

        let message = '';

        const {details, cause} = error.help;

        if (details !== undefined) {
            message += `\n\n${chalk.bold('Details')}\n`;
            message += details
                .map(detail => ` • ${format(detail)}`)
                .join('\n');
        }

        if (error.reason === ErrorReason.OTHER && cause instanceof Error) {
            message += ConsoleOutput.formatStackTrace(error);
        }

        return message;
    }

    private static formatStackTrace(error: unknown): string {
        if (!(error instanceof Error) || error.stack === undefined) {
            return '';
        }

        const stack = error.stack
            .split('\n')
            .map((line => ` › ${line.trim().replace(/^at /, '')}`))
            .slice(1);

        return `\n\n${chalk.bold('Stack trace')}\n${stack.join('\n')}`;
    }

    private static formatErrorSuggestions(error: HelpfulError): string {
        const {suggestions} = error.help;
        let message = '';

        if (suggestions !== undefined && suggestions.length > 0) {
            if (suggestions.length === 1) {
                message += `\n\n${format(suggestions[0])}`;
            } else {
                message += `\n\n${chalk.bold('Suggestions')}\n`;
                message += suggestions.map(suggestion => ` • ${format(suggestion)}`)
                    .join('\n');
            }
        }

        return message;
    }

    private static formatErrorUsefulLinks(error: HelpfulError): string {
        const usefulLinks: Help['links'] = [];
        let message = '';

        switch (error.reason) {
            case ErrorReason.INVALID_INPUT:
            case ErrorReason.PRECONDITION:
                usefulLinks.push({
                    description: 'Documentation',
                    url: 'https://docs.croct.io/sdk/cli',
                });

                break;

            case ErrorReason.INVALID_CONFIGURATION:
                break;

            default:
                usefulLinks.push({
                    description: 'Report this issue',
                    url: 'https://github.com/croct-tech/croct-cli/issues/new',
                });

                break;
        }

        if (error.help.links !== undefined) {
            usefulLinks.push(...error.help.links);
        }

        if (usefulLinks.length > 0) {
            message += `\n\n${chalk.bold('Useful links')}\n`;
            message += usefulLinks.map(
                ({description, url}) => ` • ${terminalLink(description, url, {
                    fallback: () => `${description}: ${url}`,
                })}`,
            ).join('\n');
        }

        return message;
    }

    private writeLog(text: string, semantic: Semantic): void {
        this.write(`${format(text, semantic === 'neutral' ? {} : {icon: {semantic: semantic}})}\n`);
    }

    private write(text: string, critical = false): void {
        if (!this.quiet || critical) {
            this.output.write(text);
        }
    }
}
