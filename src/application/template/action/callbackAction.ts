import {Action, ActionError, ActionOptions} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type Callback<T extends ActionOptions> = (options: T, context: ActionContext) => Promise<void>;

export type Configuration<T extends ActionOptions> = {
    callback: Callback<T>,
};

export class CallbackAction<T extends ActionOptions> implements Action<T> {
    private readonly callback: Callback<T>;

    public constructor({callback}: Configuration<T>) {
        this.callback = callback;
    }

    public async execute(options: T, context: ActionContext): Promise<void> {
        try {
            return await this.callback(options, context);
        } catch (error) {
            if (!(error instanceof ActionError)) {
                throw ActionError.fromCause(error);
            }
        }
    }
}
