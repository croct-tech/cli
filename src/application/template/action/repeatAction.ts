import {Action, ActionRunner} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type RepeatOptions = {
    condition: Promise<unknown>,
    actions: Promise<unknown>,
};

export class RepeatAction implements Action<RepeatOptions> {
    private readonly runner: ActionRunner;

    public constructor(runner: ActionRunner) {
        this.runner = runner;
    }

    public async execute(options: RepeatOptions, context: ActionContext): Promise<void> {
        // eslint-disable-next-line no-extra-boolean-cast -- Intentional type juggling to match JS behavior
        while (Boolean(await options.condition)) {
            await this.run(options.actions, context);
        }
    }

    private run(actions: Promise<unknown>, context: ActionContext): Promise<void> {
        return this.runner.execute({actions: actions}, context);
    }
}
