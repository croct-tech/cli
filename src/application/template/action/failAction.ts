import {Action, ActionError} from '@/application/template/action/action';
import {ErrorReason, Help} from '@/application/error';

export type FailOptions = Pick<Help, 'title' | 'links' | 'suggestions' | 'details'> & {
    message: string,
};

export class FailAction implements Action<FailOptions> {
    public execute(options: FailOptions): Promise<void> {
        const {message, ...help} = options;

        throw new ActionError(message, {
            ...help,
            reason: ErrorReason.PRECONDITION,
        });
    }
}
