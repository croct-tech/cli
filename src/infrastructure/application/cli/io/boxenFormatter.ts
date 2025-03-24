import boxen, {Options as BoxenOptions} from 'boxen';
import chalk from 'chalk';
import terminalLink from 'terminal-link';
import {ErrorReason, Help, HelpfulError} from '@/application/error';
import {colors, format} from '@/infrastructure/application/cli/io/formatting';
import {Callout, LogFormatter} from '@/application/cli/io/logFormatter';

export class BoxenFormatter implements LogFormatter {
    private readonly boxenStyle: BoxenOptions;

    public constructor(boxenStyle?: BoxenOptions) {
        this.boxenStyle = boxenStyle ?? {
            titleAlignment: 'center',
            borderStyle: 'round',
            padding: {
                top: 1,
                bottom: 1,
                right: 2,
                left: 2,
            },
        };
    }

    public formatCallout(callout: Callout): string {
        return boxen(format(callout.message), {
            ...this.boxenStyle,
            title: format(callout.title, {basic: true}),
            textAlignment: callout.alignment,
            borderColor: colors[callout.semantics],
        });
    }

    public formatError(error: unknown): string {
        return boxen(BoxenFormatter.formatErrorBody(error), {
            ...this.boxenStyle,
            title: BoxenFormatter.formatErrorTitle(error),
            borderColor: 'red',
        });
    }

    private static formatErrorTitle(error: unknown): string {
        if (!(error instanceof HelpfulError)) {
            return 'Unexpected error';
        }

        const titles: Record<ErrorReason, string> = {
            [ErrorReason.ACCESS_DENIED]: 'Access denied',
            [ErrorReason.INVALID_CONFIGURATION]: 'Invalid configuration',
            [ErrorReason.INVALID_INPUT]: 'Invalid input',
            [ErrorReason.NOT_FOUND]: 'Not found',
            [ErrorReason.NOT_SUPPORTED]: 'Not supported',
            [ErrorReason.PRECONDITION]: 'Precondition failed',
            [ErrorReason.UNEXPECTED_RESULT]: 'Unexpected result',
            [ErrorReason.OTHER]: 'Error',
        };

        return titles[error.reason];
    }

    private static formatErrorBody(error: unknown): string {
        let body = format(HelpfulError.formatMessage(error));

        if (error instanceof HelpfulError) {
            body += BoxenFormatter.formatErrorDetails(error);

            const {cause} = error.help;

            if (cause !== undefined && !BoxenFormatter.isCauseReported(error.message, cause)) {
                body += `\n\n🚨 ${chalk.bold('Cause')}\n`;
                body += `${format(HelpfulError.formatMessage(error.help.cause))}`;
            }

            body += BoxenFormatter.formatErrorSuggestions(error);
            body += BoxenFormatter.formatErrorUsefulLinks(error);
        }

        if (
            !(error instanceof HelpfulError)
            || (error.reason === ErrorReason.OTHER && error.help.cause instanceof Error)
        ) {
            body += BoxenFormatter.formatStackTrace(error);
        }

        return body;
    }

    private static isCauseReported(message: string, cause: unknown): boolean {
        return message.toLowerCase().includes(HelpfulError.formatMessage(cause).toLowerCase());
    }

    private static formatErrorDetails(error: HelpfulError): string {
        let message = '';

        const {details} = error.help;

        if (details !== undefined) {
            message += `\n\n🔍 ${chalk.bold('Details')}\n`;
            message += details.map(detail => ` • ${format(detail)}`)
                .join('\n');
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

        return `\n\n📄 ${chalk.bold('Stack trace')}\n${stack.join('\n')}`;
    }

    private static formatErrorSuggestions(error: HelpfulError): string {
        const {suggestions} = error.help;
        let message = '';

        if (suggestions !== undefined && suggestions.length > 0) {
            message += `\n\n💡 ${chalk.bold('Suggestions')}\n`;
            message += suggestions.map(suggestion => ` • ${format(suggestion)}`)
                .join('\n');
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
                    label: 'Documentation',
                    url: 'https://docs.croct.io/sdk/cli',
                });

                break;

            case ErrorReason.INVALID_CONFIGURATION:
                break;

            default:
                usefulLinks.push({
                    label: 'Open an issue',
                    url: 'https://github.com/croct-tech/croct-cli/issues/new',
                });

                break;
        }

        if (error.help.links !== undefined) {
            usefulLinks.push(...error.help.links);
        }

        if (usefulLinks.length > 0) {
            message += `\n\n🔗 ${chalk.bold('Useful links')}\n`;
            message += usefulLinks.map(
                ({label, url}) => ` • ${terminalLink(label, url, {
                    fallback: () => `${label}: ${url}`,
                })}`,
            ).join('\n');
        }

        return message;
    }
}
