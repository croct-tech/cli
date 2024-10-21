export type ResultCode<T> = {
    modified: boolean,
    result: T,
};

export type CodemodOptions = Record<string, any>;

export interface Codemod<T, O extends CodemodOptions = CodemodOptions> {
    apply(input: T, options?: O): Promise<ResultCode<T>>;
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
