import {Action, ActionError, ActionOptions} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason, Help} from '@/application/error';
import {ActionDefinition} from '@/application/template/template';

export type TryOptions = {
    action: ActionDefinition,
    otherwise?: ActionDefinition,
    help?: Pick<Help, | 'links' | 'suggestions'> & {
        message?: string,
    },
};

export class TryAction implements Action<TryOptions> {
    private readonly actions: Record<string, Action>;

    public constructor(actions: Record<string, Action>) {
        this.actions = actions;
    }

    public async execute(options: ActionOptions, context: ActionContext): Promise<void> {
        try {
            await this.try(options.action, context);
        } catch (error) {
            if (options.otherwise === undefined) {
                if (options.help === undefined) {
                    throw error;
                }

                throw ActionError.fromCause(error, options.help);
            }

            return this.try(options.otherwise, context);
        }
    }

    private try({name, ...options}: ActionDefinition, context: ActionContext): Promise<void> {
        const action = this.actions[name];

        if (action === undefined) {
            throw new ActionError(`Action "${name}" is not supported`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        return action.execute(options, context);
    }
}
