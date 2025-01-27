import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason} from '@/application/error';
import {ActionDefinition} from '@/application/template/template';

export type RunOptions = {
    actions: ActionDefinition[],
};

export class RunAction implements Action<RunOptions> {
    private readonly actions: Record<string, Action>;

    public constructor(actions: Record<string, Action>) {
        this.actions = actions;
    }

    public async execute(options: RunOptions, context: ActionContext): Promise<void> {
        for (const action of options.actions) {
            await this.run(action, context);
        }
    }

    private run({name, ...options}: ActionDefinition, context: ActionContext): Promise<void> {
        const action = this.actions[name];

        if (action === undefined) {
            throw new ActionError(`Unsupported action \`${name}\`.`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        return action.execute(options, context);
    }
}
