import {Action, ActionError, ActionRunner} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {Help} from '@/application/error';

export type TryOptions = {
    run: Promise<unknown>|Array<Promise<unknown>>,
    else?: Promise<unknown>|Array<Promise<unknown>>,
    help?: Pick<Help, | 'links' | 'suggestions'> & {
        message?: string,
    },
};

export class TryAction implements Action<TryOptions> {
    private readonly runner: ActionRunner;

    public constructor(runner: ActionRunner) {
        this.runner = runner;
    }

    public async execute(options: TryOptions, context: ActionContext): Promise<void> {
        try {
            await this.run(options.run, context);
        } catch (error) {
            if (options.else === undefined) {
                if (options.help === undefined) {
                    throw error;
                }

                throw ActionError.fromCause(error, options.help);
            }

            return this.run(options.else, context);
        }
    }

    private run(action: Promise<unknown>|Array<Promise<unknown>>, context: ActionContext): Promise<void> {
        return this.runner.execute({actions: Array.isArray(action) ? action : [action]}, context);
    }
}
