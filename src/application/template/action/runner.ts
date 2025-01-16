import {ActionDefinition, ActionMap, ActionName} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export class ActionRunner<T extends ActionName = ActionName> {
    private readonly actions: ActionMap<T>;

    public constructor(actions: ActionMap<T>) {
        this.actions = actions;
    }

    public async run(actions: Array<ActionDefinition<T>>, context: ActionContext): Promise<void> {
        for (const options of actions) {
            const action = this.actions[options.name];

            await action.execute(options, context);
        }
    }
}
