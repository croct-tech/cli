import {CliError, CliHelp} from '@/application/cli/error';
import {ActionContext} from '@/application/template/action/context';
import {formatMessage} from '@/application/error';

export interface ActionOptionsMap {
}

export type ActionName = keyof ActionOptionsMap;

export type ActionOptions<T extends ActionName = ActionName> = {
    [K in T]: ActionOptionsMap[K];
}[T];

export type ActionDefinition<T extends ActionName = ActionName> = {
    [K in T]: ActionOptionsMap[K] & {
        name: K,
    }
}[T];

export type ActionMap<T extends ActionName = ActionName> = {
    [K in T]: Action<ActionOptions<K>>;
};

type ExtendedHelp = CliHelp & {
    message?: string,
};

export class ActionError extends CliError {
    public constructor(message: string, help?: CliHelp) {
        super(message, help);

        Object.setPrototypeOf(this, ActionError.prototype);
    }

    public static fromCause(cause: unknown, help: ExtendedHelp = {}): ActionError {
        const {message, ...helpProps} = help;

        if (!(cause instanceof Error)) {
            return new ActionError(message ?? formatMessage(cause), {
                ...helpProps,
                cause: cause,
            });
        }

        const error = new ActionError(message ?? cause.message, {
            ...(cause instanceof CliError ? cause.help : {}),
            ...helpProps,
            cause: cause,
        });

        error.stack = cause.stack;

        return error;
    }
}

export interface Action<T extends Record<string, any>> {
    execute(options: T, context: ActionContext): Promise<void>;
}
