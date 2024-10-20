export type ResultCode<T> = {
    modified: boolean,
    result: T,
};

export interface Codemod<I, O extends Record<string, any> = Record<string, never>> {
    apply(input: I, options?: O): Promise<ResultCode<I>>|ResultCode<I>;
}

export class CodemodError extends Error {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, CodemodError.prototype);
    }
}

export class MalformedCodeError extends CodemodError {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, MalformedCodeError.prototype);
    }
}
