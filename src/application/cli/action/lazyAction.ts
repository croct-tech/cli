import {Action, ActionOptions} from '@/application/cli/action/action';
import {ActionContext} from '@/application/cli/action/context';

export type ActionFactory<T extends ActionOptions> = () => Action<T>;

export class LazyAction<T extends ActionOptions> implements Action<T> {
    private readonly factory: ActionFactory<T>;

    private actions: Action<T>;

    public constructor(factory: ActionFactory<T>) {
        this.factory = factory;
    }

    public execute(options: T, context: ActionContext): Promise<void> {
        if (this.actions === undefined) {
            this.actions = this.factory();
        }

        return this.actions.execute(options, context);
    }
}
