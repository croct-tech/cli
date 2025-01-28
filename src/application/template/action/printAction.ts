import {Action} from '@/application/template/action/action';
import {Semantic} from '@/application/cli/io/output';
import {ActionContext} from '@/application/template/action/context';

export type PrintOptions = {
    semantic?: Semantic,
    title?: string,
    message: string,
};

export class PrintAction implements Action<PrintOptions> {
    public execute(options: PrintOptions, context: ActionContext): Promise<void> {
        const logger = context.output;
        const semantic = options.semantic ?? 'neutral';

        if (options.title === undefined) {
            logger.log(options.message, semantic);
        } else {
            logger.announce({
                semantic: semantic,
                title: options.title,
                message: options.message,
            });
        }

        return Promise.resolve();
    }
}
