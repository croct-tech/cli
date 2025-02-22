import {ActionContext} from '@/application/template/action/context';
import {HelpfulError, Help} from '@/application/error';
import {SourceLocation} from '@/application/template/template';

export type ActionInfo = {
    name: string,
    source?: SourceLocation,
};

export type ActionHelp = Help & {
    tracing?: ActionInfo[],
};

type OverridableHelp = ActionHelp & {
    message?: string,
};

export class ActionError extends HelpfulError {
    public readonly tracing: ActionInfo[];

    public constructor(message: string, {tracing, ...help}: ActionHelp = {}) {
        super(message, help);

        this.tracing = tracing ?? [];

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
            tracing: [
                ...helpProps.tracing ?? [],
                ...cause instanceof ActionError ? cause.tracing : [],
            ],
        });

        error.stack = cause.stack;

        return error;
    }
}

export type ActionOptions = Record<string, any>;

export interface Action<T extends ActionOptions = ActionOptions> {
    execute(options: T, context: ActionContext): Promise<void>;
}

export interface ActionRunner extends Action<{actions: any}> {
}
