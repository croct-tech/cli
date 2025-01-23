import {Action} from '@/application/template/action/action';
import {Logger, Semantic} from '@/application/cli/io/output';

export type LogOptions = {
    semantic?: Semantic,
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
        this.logger.log(options.message, options.semantic);

        return Promise.resolve();
    }
}
