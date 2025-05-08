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

        const subcontext: LogContext<L> = {
            level: parentContext !== undefined ? parentContext.level + 1 : 0,
            logs: [],
        };

        return this.storage.run(subcontext, async () => {
            const result = await this.logNested(subcontext, log, callback);

            if (parentContext !== undefined) {
                parentContext.logs.push(...subcontext.logs);
            } else {
                subcontext.logs.forEach(entry => this.logger.log(entry));
                subcontext.logs = [];
            }

            return result;
        });
    }

    private async logNested<R>(context: LogContext<L>, log: L, callback: Callback<R>): Promise<R> {
        this.buffer(context, {
            ...log,
            message: `┌─ ${log.message}`,
        });

        try {
            return await callback();
        } finally {
            this.buffer(context, {
                ...log,
                message: '└─',
            });
        }
    }

    public log(log: L): void {
        const context = this.storage.getStore();

        if (context !== undefined) {
            this.buffer(context, {...log, message: `│ ${log.message}`});

            return;
        }

        this.logger.log(log);
    }

    private buffer(context: LogContext<L>, log: L): void {
        context.logs.push({
            ...log,
            message: `${context.level > 0 ? `${'│ '.repeat(context.level)}` : ''}${log.message}`,
        });
    }
}
