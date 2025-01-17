import {Help, HelpfulError} from '@/application/error';

export type ResultCode<T> = {
    modified: boolean,
    result: T,
};

export type CodemodOptions = Record<never, never>;

export interface Codemod<T, O extends CodemodOptions = CodemodOptions> {
    apply(input: T, options?: O): Promise<ResultCode<T>>;
}

export class CodemodError extends HelpfulError {
    public constructor(message: string, help: Help = {}) {
        super(message, help);

        Object.setPrototypeOf(this, CodemodError.prototype);
    }
}

export class MalformedCodeError extends CodemodError {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, MalformedCodeError.prototype);
    }
}
