import {Action} from '@/application/template/action/action';
import {Logger, Semantic} from '@/application/cli/io/output';

export type LogOptions = {
    semantic?: Semantic,
    title?: string,
    message: string,
};

export type Configuration = {
    logger: Logger,
};

export class LogAction implements Action<LogOptions> {
    private readonly logger: Logger;

    public constructor({logger}: Configuration) {
        this.logger = logger;
    }

    public execute(options: LogOptions): Promise<void> {
        const semantic = options.semantic ?? 'neutral';

        if (options.title === undefined) {
            this.logger.log(options.message, semantic);
        } else {
            this.logger.announce({
                semantic: semantic,
                title: options.title,
                message: options.message,
            });
        }

        return Promise.resolve();
    }
}
