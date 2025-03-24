import {Input} from '@/application/cli/io/input';

import {HelpfulError, Help} from '@/application/error';

export type Instruction = Help & {
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

    public wait(): Promise<string> {
        return this.report();
    }

    private report(): never {
        const {message, ...help} = this.instruction;

        throw new HelpfulError(message, help);
    }
}
