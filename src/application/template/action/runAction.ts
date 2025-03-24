import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason} from '@/application/error';
import {ActionDefinition, SourceLocation} from '@/application/template/template';

export type RunOptions = {
    actions: ActionDefinition|ActionDefinition[],
};

export class RunAction implements Action<RunOptions> {
    private readonly actions: Record<string, Action>;

    public constructor(actions: Record<string, Action>) {
        this.actions = actions;
    }

    public async execute(options: RunOptions, context: ActionContext): Promise<void> {
        for (const action of Array.isArray(options.actions) ? options.actions : [options.actions]) {
            try {
                await this.run(action, context);
            } catch (error) {
                throw ActionError.fromCause(error, {
                    tracing: [
                        {
                            name: action.name,
                            source: SourceLocation.get(action) ?? undefined,
                        },
                    ],
                });
            }
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
