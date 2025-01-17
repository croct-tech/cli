export type Violation = {
    path: string,
    message: string,
};

export type ValidResult<T> = {
    success: true,
    data: T,
    violations?: never,
};

export declare type InvalidResult = {
    success: false,
    violations: Violation[],
    data?: never,
};

export type ValidationResult<T> = ValidResult<T> | InvalidResult;

export interface Validator<T> {
    validate(data: unknown): ValidationResult<T>;
}
