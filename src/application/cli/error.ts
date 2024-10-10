type Link = {
    link: string,
    description: string,
};

export type CliHelp = {
    cause?: any,
    suggestions?: string[],
    links?: Link[],
};

export class CliError extends Error {
    public readonly help: Readonly<CliHelp>;

    public constructor(message: string, troubleshooting: CliHelp = {}) {
        super(message);

        this.help = troubleshooting;

        Object.setPrototypeOf(this, CliError.prototype);
    }

    public static formatMessage(error: unknown): string {
        const message = CliError.extractMessage(error);

        if (message.length === 0) {
            return message;
        }

        return message.charAt(0).toUpperCase() + message.slice(1);
    }

    public static formatCause(error: unknown): string {
        const message = CliError.formatMessage(error);

        if (message.length === 0) {
            return message;
        }

        return message.charAt(0).toLowerCase() + message.slice(1);
    }

    private static extractMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        if (typeof error === 'string' && error !== '') {
            return error;
        }

        return 'unknown error';
    }
}
