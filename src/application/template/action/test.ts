import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason} from '@/application/error';
import {ActionDefinition} from '@/application/template/template';

export type TestOptions = {
    condition: boolean,
    then?: ActionDefinition,
    else?: ActionDefinition,
};

export class TestAction implements Action<TestOptions> {
    private readonly actions: Record<string, Action>;

    public constructor(actions: Record<string, Action>) {
        this.actions = actions;
    }

    public execute(options: TestOptions, context: ActionContext): Promise<void> {
        if (options.condition) {
            return options.then !== undefined
                ? this.run(options.then, context)
                : Promise.resolve();
        }

        return options.else !== undefined
            ? this.run(options.else, context)
            : Promise.resolve();
    }

    private run({name, ...options}: ActionDefinition, context: ActionContext): Promise<void> {
        const action = this.actions[name];

        if (action === undefined) {
            throw new ActionError(`Action "${name}" is not supported`, {
                reason: ErrorReason.INVALID_INPUT,
            });
        }

        return action.execute(options, context);
    }
}
