import {Action, ActionRunner} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type TestOptions = {
    if: boolean,
    run?: Promise<unknown>|Array<Promise<unknown>>,
    else?: Promise<unknown>|Array<Promise<unknown>>,
};

export class TestAction implements Action<TestOptions> {
    private readonly runner: ActionRunner;

    public constructor(runner: ActionRunner) {
        this.runner = runner;
    }

    public execute(options: TestOptions, context: ActionContext): Promise<void> {
        if (options.if) {
            return options.run !== undefined
                ? this.run(options.run, context)
                : Promise.resolve();
        }

        return options.else !== undefined
            ? this.run(options.else, context)
            : Promise.resolve();
    }

    private run(action: Promise<unknown>|Array<Promise<unknown>>, context: ActionContext): Promise<void> {
        return this.runner.execute({actions: Array.isArray(action) ? action : [action]}, context);
    }
}
