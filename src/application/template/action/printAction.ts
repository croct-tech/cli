import {Action} from '@/application/template/action/action';
import {Semantics} from '@/application/cli/io/output';
import {ActionContext} from '@/application/template/action/context';

export type PrintOptions = {
    semantics?: Semantics,
    title?: string,
    message: string,
};

export class PrintAction implements Action<PrintOptions> {
    public execute(options: PrintOptions, context: ActionContext): Promise<void> {
        const logger = context.output;
        const semantics = options.semantics ?? 'neutral';

        if (options.title === undefined) {
            logger.log(options.message, semantics);
        } else {
            logger.announce({
                alignment: 'left',
                semantics: semantics,
                title: options.title,
                message: options.message,
            });
        }

        return Promise.resolve();
    }
}
