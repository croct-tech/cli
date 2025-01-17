type Link = {
    url: string,
    description: string,
};

export enum ErrorReason {
    PRECONDITION = 'precondition',
    INVALID_CONFIGURATION = 'invalid_configuration',
    ACCESS_DENIED = 'access_denied',
    INVALID_INPUT = 'invalid_input',
    OTHER = 'other',
}

export type Help = {
    title?: string,
    reason?: ErrorReason,
    cause?: any,
    suggestions?: string[],
    details?: string[],
    links?: Link[],
};

export class HelpfulError extends Error {
    public readonly help: Readonly<Help>;

    public readonly reason: ErrorReason;

    public constructor(message: string, help: Help = {}) {
        super(message);

        this.help = help;
        this.reason = help.reason ?? ErrorReason.OTHER;

        Object.setPrototypeOf(this, HelpfulError.prototype);
    }

    public static formatMessage(error: unknown): string {
        const message = HelpfulError.extractMessage(error);

        if (message.length === 0) {
            return message;
        }

        return message.charAt(0).toUpperCase() + message.slice(1);
    }

    public static formatCause(error: unknown): string {
        const message = HelpfulError.formatMessage(error);

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
