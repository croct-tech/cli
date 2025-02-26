import {Log, Logger} from '@croct/logging';
import {Output} from '@/application/cli/io/output';

export class OutputLogger<L extends Log = Log> implements Logger<L> {
    private readonly output: Output;

    public constructor(output: Output) {
        this.output = output;
    }

    public log(log: L): void {
        switch (log.level) {
            case 'debug':
                this.output.debug(log.message);

                break;

            case 'info':
                this.output.inform(log.message);

                break;

            case 'warning':
                this.output.warn(log.message);

                break;

            case 'error':
                this.output.alert(log.message);
        }
    }
}
