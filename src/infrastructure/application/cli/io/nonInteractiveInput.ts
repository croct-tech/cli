import {Input} from '@/application/cli/io/input';
import {CliError, CliHelp} from '@/application/cli/error';

export type Instruction = CliHelp & {
    message: string,
};

export class NonInteractiveInput implements Input {
    private readonly instruction: Instruction;

    public constructor(instruction: Instruction) {
        this.instruction = instruction;
    }

    public prompt(): Promise<string> {
        return this.report();
    }

    public select<T>(): Promise<T> {
        return this.report();
    }

    public selectMultiple<T>(): Promise<T[]> {
        return this.report();
    }

    public confirm(): Promise<boolean> {
        return this.report();
    }

    private report(): never {
        const {message, ...help} = this.instruction;

        throw new CliError(message, help);
    }
}
