import {Action, ActionOptions} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type ActionFactory<T extends ActionOptions> = () => Action<T>;

export class LazyAction<T extends ActionOptions> implements Action<T> {
    private readonly factory: ActionFactory<T>;

    private action?: Action<T>;

    public constructor(factory: ActionFactory<T>) {
        this.factory = factory;
    }

    public execute(options: T, context: ActionContext): Promise<void> {
        if (this.action === undefined) {
            this.action = this.factory();
        }

        return this.action.execute(options, context);
    }
}
