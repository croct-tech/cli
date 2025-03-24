import {Readable, Writable} from 'stream';
import {KeyboardInput, MockInput} from './mockInput';
import {MockOutput} from './mockOutput';

class AnswerBuilder implements KeyboardInput {
    private readonly operations: Array<(keyboard: KeyboardInput) => void> = [];

    public type(input: string): KeyboardInput {
        this.operations.push(keyboard => keyboard.type(input));

        return this;
    }

    public enter(): KeyboardInput {
        this.operations.push(keyboard => keyboard.enter());

        return this;
    }

    public arrowUp(): KeyboardInput {
        this.operations.push(keyboard => keyboard.arrowUp());

        return this;
    }

    public arrowDown(): KeyboardInput {
        this.operations.push(keyboard => keyboard.arrowDown());

        return this;
    }

    public space(): KeyboardInput {
        this.operations.push(keyboard => keyboard.space());

        return this;
    }

    public backspace(): KeyboardInput {
        this.operations.push(keyboard => keyboard.backspace());

        return this;
    }

    public answer(input: KeyboardInput): void {
        for (const operation of this.operations) {
            operation(input);
        }
    }
}

export class MockIo {
    private readonly mockInput: MockInput;

    private readonly mockOutput: MockOutput;

    public constructor() {
        this.mockInput = new MockInput();
        this.mockOutput = new MockOutput();
    }

    public get input(): Readable {
        return this.mockInput;
    }

    public get output(): Writable {
        return this.mockOutput;
    }

    public when(matcher: RegExp): KeyboardInput {
        const builder = new AnswerBuilder();

        this.mockOutput.match(matcher, () => {
            builder.answer(this.mockInput);
        });

        return builder;
    }

    public getFrames(): string[] {
        return this.mockOutput.getFrames();
    }

    public getFinalOutput(): string {
        return this.mockOutput.getFinalOutput();
    }
}
