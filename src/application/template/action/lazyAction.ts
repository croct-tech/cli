import type {Action, ActionOptions} from '@/application/template/action/action';
import {ActionError} from '@/application/template/action/action';
import type {ActionContext} from '@/application/template/action/context';
import type {Provider} from '@/application/provider/provider';
import {ProviderError} from '@/application/provider/provider';

export class LazyAction<T extends ActionOptions> implements Action<T> {
    private readonly provider: Provider<Action<T>>;

    public constructor(factory: Provider<Action<T>>) {
        this.provider = factory;
    }

    private get action(): Promise<Action<T>> {
        return Promise.resolve(this.provider.get()).catch(error => {
            if (error instanceof ProviderError) {
                throw new ActionError(error.message, error.help);
            }

            throw error;
        });
    }

    public async execute(options: T, context: ActionContext): Promise<void> {
        return (await this.action).execute(options, context);
    }
}
