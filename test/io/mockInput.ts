import {Readable} from 'stream';

export interface KeyboardInput {
    type(input: string): KeyboardInput;
    enter(): KeyboardInput;
    arrowUp(): KeyboardInput;
    arrowDown(): KeyboardInput;
    space(): KeyboardInput;
    backspace(): KeyboardInput;
}

export class MockInput extends Readable implements KeyboardInput {
    private buffer: string[] = [];

    public _read(): void {
        this.push(this.buffer.shift() ?? '');
    }

    public type(input: string): KeyboardInput {
        for (const char of input) {
            this.buffer.push(char);
        }

        return this;
    }

    public enter(): KeyboardInput {
        this.buffer.push('\n');

        return this;
    }

    public arrowUp(): KeyboardInput {
        this.buffer.push('\u001b[A');

        return this;
    }

    public arrowDown(): KeyboardInput {
        this.buffer.push('\u001b[B');

        return this;
    }

    public space(): KeyboardInput {
        this.buffer.push(' ');

        return this;
    }

    public backspace(): KeyboardInput {
        this.buffer.push('\u0008');

        return this;
    }
}
