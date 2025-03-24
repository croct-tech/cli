import {Writable} from 'stream';
import stripAnsi from 'strip-ansi';

type InputCallback = (input: string) => void;

type InputListener = {
    matcher: RegExp,
    callback: InputCallback,
};

export class MockOutput extends Writable {
    private readonly frames: string[] = [];

    private readonly inputListeners: InputListener[] = [];

    public _write(chunk: any, _: string, callback: (error?: Error | null) => void): void {
        const input = stripAnsi(chunk.toString());

        this.frames.push(input);

        callback();

        for (const listener of this.inputListeners) {
            if (listener.matcher.test(input)) {
                listener.callback(input);
            }
        }
    }

    public match(matcher: RegExp, callback: InputCallback): MockOutput {
        const listener: InputListener = {
            matcher: matcher,
            callback: input => {
                const index = this.inputListeners.indexOf(listener);

                if (index !== -1) {
                    this.inputListeners.splice(index, 1);
                }

                callback(input);
            },
        };

        this.inputListeners.push(listener);

        return this;
    }

    public getFrames(): string[] {
        return this.frames.filter(frame => frame.trim() !== '');
    }

    public getFinalOutput(): string {
        for (let index = this.frames.length - 1; index >= 0; index--) {
            if (this.frames[index].trim() !== '') {
                return this.frames[index];
            }
        }

        return this.frames[this.frames.length - 1];
    }
}
