import {Confirmation, Input, MultipleSelection, Prompt, Selection} from '@/application/cli/io/input';
import {CliError, CliHelp} from '@/application/cli/error';

export type Instruction = CliHelp & {
    message: string,
};

export class NonInteractiveInput implements Input {
    private readonly instruction: Instruction;

    public constructor(instruction: Instruction) {
        this.instruction = instruction;
    }

    public prompt(_: Prompt): Promise<string> {
        return this.report();
    }

    public select<T>(_: Selection<T>): Promise<T> {
        return this.report();
    }

    public selectMultiple<T>(_: MultipleSelection<T>): Promise<T[]> {
        return this.report();
    }

    public confirm(_: Confirmation): Promise<boolean> {
        return this.report();
    }

    private report(): never {
        const {message, ...help} = this.instruction;

        throw new CliError(message, help);
    }
}
