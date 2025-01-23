import {ActionContext} from '@/application/template/action/context';
import {HelpfulError, Help} from '@/application/error';

type OverridableHelp = Help & {
    message?: string,
};

export class ActionError extends HelpfulError {
    public constructor(message: string, help?: Help) {
        super(message, help);

        Object.setPrototypeOf(this, ActionError.prototype);
    }

    public static fromCause(cause: unknown, help: OverridableHelp = {}): ActionError {
        const {message, ...helpProps} = help;

        if (!(cause instanceof Error)) {
            return new ActionError(message ?? HelpfulError.formatMessage(cause), {
                ...helpProps,
                cause: cause,
            });
        }

        const error = new ActionError(message ?? cause.message, {
            cause: cause,
            ...(cause instanceof HelpfulError ? cause.help : {}),
            ...helpProps,
        });

        error.stack = cause.stack;

        return error;
    }
}

export type ActionOptions = Record<string, any>;

export interface Action<T extends ActionOptions = ActionOptions> {
    execute(options: T, context: ActionContext): Promise<void>;
}
