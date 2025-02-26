import {AsyncLocalStorage} from 'node:async_hooks';
import {Log, Logger} from '@croct/logging';
import {Callback, HierarchicalLogger} from '@/application/logging/hierarchicalLogger';

type LogContext<L extends Log = Log> = {
    level: number,
    logs: L[],
};

export class TreeLogger<L extends Log> implements HierarchicalLogger<L> {
    private readonly logger: Logger<L>;

    private readonly storage = new AsyncLocalStorage<LogContext<L>>();

    public constructor(baseLogger: Logger<L>) {
        this.logger = baseLogger;
    }

    public nest<R>(log: L, callback: Callback<R>): Promise<R> {
        const parentContext = this.storage.getStore();

        if (parentContext !== undefined) {
            return this.logNested(parentContext, log, callback);
        }

        const subcontext: LogContext<L> = {
            level: 0,
            logs: [],
        };

        return this.storage.run(subcontext, () => this.logNested(subcontext, log, callback));
    }

    private async logNested<R>(context: LogContext<L>, log: L, callback: Callback<R>): Promise<R> {
        this.buffer(context, {
            ...log,
            message: `┌─ ${log.message}`,
        });

        context.level++;

        try {
            return await callback();
        } finally {
            context.level--;

            this.buffer(context, {
                ...log,
                message: '└─',
            });

            if (context.level === 0) {
                context.logs.forEach(entry => this.logger.log(entry));
                context.logs = [];
            }
        }
    }

    public log(log: L): void {
        const context = this.storage.getStore();

        if (context !== undefined) {
            this.buffer(context, log);

            return;
        }

        this.logger.log(log);
    }

    private buffer(context: LogContext<L>, log: L): void {
        context.logs.push({
            ...log,
            message: `${context.level > 0 ? `${'│ '.repeat(context.level - 1)}│ ` : ''}${log.message}`,
        });
    }
}
