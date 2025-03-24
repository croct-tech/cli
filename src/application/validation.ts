export type Violation = {
    path: string,
    message: string,
};

export type ValidResult<T> = {
    valid: true,
    data: T,
    violations?: never,
};

export declare type InvalidResult = {
    valid: false,
    violations: Violation[],
    data?: never,
};

type MaybePromise<T> = T | Promise<T>;

export type ValidationResult<T> = ValidResult<T> | InvalidResult;

export interface Validator<T> {
    validate(data: unknown): MaybePromise<ValidationResult<T>>;
}
