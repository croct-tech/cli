import ora, {Ora} from 'ora';
import open from 'open';
import chalk from 'chalk';
import boxen from 'boxen';
import terminalLink from 'terminal-link';
import {render as renderMarkdown, unescape as unscapeMarkdown} from '@croct/md-lite';
import {Writable} from 'stream';
import {Output, Spinner, SpinnerFlowOptions} from '@/application/cli/io/output';
import {CliError, CliHelp} from '@/application/cli/error';

export type ExitCallback = () => never;

export type Configuration = {
    output: Writable,
    onExit: ExitCallback,
};

type SpinnerStack = {
    instance: Ora,
    previous?: SpinnerStack,
};

export class ConsoleOutput implements Output {
    private readonly output: Writable;

    private readonly onExit: ExitCallback;

    private spinnerStack?: SpinnerStack;

    public constructor({output, onExit}: Configuration) {
        this.output = output;
        this.onExit = onExit;
    }

    public async open(target: string): Promise<void> {
        await open(target);
    }

    public log(text: string): void {
        this.output.write(`${text}\n`);
    }

    public error(text: string): void {
        this.output.write(chalk.red(`${text}\n`));
    }

    public info(text: string): void {
        this.output.write(chalk.cyan(`${text}\n`));
    }

    public warn(text: string): void {
        this.output.write(chalk.yellow(`${text}\n`));
    }

    public success(text: string): void {
        this.output.write(chalk.green(`${text}\n`));
    }

    public suspendSpinner(): void {
        this.spinnerStack
            ?.instance
            .stop();
    }

    public resumeSpinner(): void {
        this.spinnerStack
            ?.instance
            .start();
    }

    public createSpinner(initialStatus?: string): Spinner {
        const instance = ora({
            stream: this.output,
        });

        let interval: NodeJS.Timeout | null = null;

        const clear = (start = false): void => {
            if (interval !== null) {
                clearInterval(interval);
            }

            if (start) {
                this.suspendSpinner();

                this.spinnerStack = {
                    instance: instance,
                    previous: this.spinnerStack,
                };
            } else {
                this.spinnerStack = this.spinnerStack?.previous;

                this.resumeSpinner();
            }
        };

        const spinner: Spinner = {
            start: (status: string) => {
                clear(true);

                instance.start(status);

                return spinner;
            },
            stop: (persist: boolean = false) => {
                clear();

                if (persist) {
                    instance.stopAndPersist();
                } else {
                    instance.stop();
                }
            },
            update: (status: string) => {
                clear();

                instance.text = status;

                return spinner;
            },
            flow: (statuses: string[], options?: SpinnerFlowOptions): Spinner => {
                clear();

                let index = 0;

                interval = setInterval(
                    () => {
                        const nextIndex = options?.loop === true
                            ? index++ % statuses.length
                            : Math.min(index++, statuses.length - 1);

                        instance.text = statuses[nextIndex];
                    },
                    options?.duration ?? 3000,
                );

                return spinner;
            },
            succeed: (status: string) => {
                clear();

                instance.succeed(status);

                return spinner;
            },
            warn: (status: string) => {
                clear();

                instance.warn(status);

                return spinner;
            },
            fail: (status: string) => {
                clear();

                instance.fail(status);

                return spinner;
            },
        };

        if (initialStatus !== undefined) {
            spinner.start(initialStatus);
        }

        return spinner;
    }

    public reportError(error: any): void {
        this.error(`\n${this.formatError(error)}`);
    }

    public exit(): never {
        this.suspendSpinner();

        this.spinnerStack = undefined;

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
                    message += `\n\n💡 ${ConsoleOutput.formatMessage(suggestions[0])}`;
                } else {
                    message += `\n\n💡 ${chalk.bold('Suggestions:')}\n`;
                    message += suggestions.map(suggestion => `  • ${ConsoleOutput.formatMessage(suggestion)}`)
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

    private static formatMessage(message: string): string {
        return renderMarkdown(message, {
            fragment: node => node.children.join(''),
            text: node => node.content,
            bold: node => chalk.bold(node.children),
            italic: node => chalk.italic(node.children),
            strike: node => chalk.strikethrough(node.children),
            code: node => chalk.cyan(node.content),
            link: node => terminalLink(node.children, node.href),
            image: node => unscapeMarkdown(node.source),
            paragraph: node => node.children.join('\n'),
        });
    }
}
