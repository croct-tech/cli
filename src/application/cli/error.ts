type Link = {
    link: string,
    description: string,
};

export enum CliErrorCode {
    PRECONDITION = 'precondition',
    INVALID_CONFIGURATION = 'invalid_configuration',
    ACCESS_DENIED = 'access_denied',
    INVALID_INPUT = 'invalid_input',
    OTHER = 'other',
}

export type CliHelp = {
    title?: string,
    code?: CliErrorCode,
    cause?: any,
    suggestions?: string[],
    details?: string[],
    links?: Link[],
};

export class CliError extends Error {
    public readonly help: Readonly<CliHelp>;

    public readonly code: CliErrorCode;

    public constructor(message: string, help: CliHelp = {}) {
        super(message);

        this.help = help;
        this.code = help.code ?? CliErrorCode.OTHER;

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
