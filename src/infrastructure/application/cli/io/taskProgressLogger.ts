import {Log, Logger} from '@croct/logging';
import {LogDetails} from '@croct/logging/logger';
import {TaskNotifier} from '@/application/cli/io/output';

export type Configuration = {
    notifier: TaskNotifier,
    status: string,
};

export class TaskProgressLogger<D extends LogDetails = LogDetails> implements Logger<Log<D>> {
    private readonly notifier: TaskNotifier;

    private readonly status: string;

    public constructor({notifier, status}: Configuration) {
        this.notifier = notifier;
        this.status = status;
    }

    public log(log: Log<D>): void {
        const subtitle = TaskProgressLogger.extractLastLine(log.message);

        if (subtitle !== '') {
            this.notifier.update(this.status, subtitle);
        }
    }

    private static extractLastLine(message: string): string {
        const lines = message.split(/\n+/);

        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();

            if (line !== '') {
                return line;
            }
        }

        return '';
    }
}
