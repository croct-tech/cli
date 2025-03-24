import {Action, ActionRunner} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';

export type TestOptions = {
    condition: boolean,
    then: Promise<unknown>,
    else?: Promise<unknown>,
};

export class TestAction implements Action<TestOptions> {
    private readonly runner: ActionRunner;

    public constructor(runner: ActionRunner) {
        this.runner = runner;
    }

    public execute(options: TestOptions, context: ActionContext): Promise<void> {
        if (options.condition) {
            return this.run(options.then, context);
        }

        return options.else !== undefined
            ? this.run(options.else, context)
            : Promise.resolve();
    }

    private run(actions: Promise<unknown>, context: ActionContext): Promise<void> {
        return this.runner.execute({actions: actions}, context);
    }
}
