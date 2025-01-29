import {Action, ActionError, ActionRunner} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {ErrorReason, Help} from '@/application/error';

export type TryOptions = {
    action: Array<Promise<unknown>>,
    else?: Array<Promise<unknown>>,
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
            await this.run(options.action, context);
        } catch (error) {
            if (options.else === undefined) {
                if (options.help === undefined) {
                    throw error;
                }

                throw ActionError.fromCause(error, {
                    ...options.help,
                    reason: ErrorReason.PRECONDITION,
                });
            }

            return this.run(options.else, context);
        }
    }

    private run(actions: Array<Promise<unknown>>, context: ActionContext): Promise<void> {
        return this.runner.execute({actions: actions}, context);
    }
}
