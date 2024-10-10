export type Confirmation = {
    message: string,
    default?: boolean,
};

export type SelectionOption<T> = {
    value: T,
    label: string,
};

export type Selection<T> = {
    message: string,
    options: Array<SelectionOption<T>>,
    default?: T,
};

export type ValidationResult = boolean | string | Promise<boolean | string>;

export type Prompt = {
    message: string,
    type?: 'text' | 'password',
    default?: string,
    validate?: (input: string) => ValidationResult,
};

export interface Input {
    confirm(confirmation: Confirmation): Promise<boolean>;
    select<T>(selection: Selection<T>): Promise<T>;
    prompt(prompt: Prompt): Promise<string>;
}
