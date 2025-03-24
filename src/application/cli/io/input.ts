export type Confirmation = {
    message: string,
    default?: boolean,
};

export type SelectionOption<T> = {
    value: T,
    label: string,
    disabled?: boolean,
};

export type MultipleSelectionOption<T> = SelectionOption<T> & {
    selected?: boolean,
};

export type Selection<T> = {
    message: string,
    options: Array<SelectionOption<T>>,
    default?: T,
};

export type MultipleSelection<T> = {
    message: string,
    options: Array<MultipleSelectionOption<T>>,
    min?: number,
    max?: number,
};

export type ValidationResult = boolean | string | Promise<boolean | string>;

export type Prompt = {
    message: string,
    type?: 'text' | 'password',
    default?: string,
    validate?: (input: string) => ValidationResult,
};

export type Wait = {
    message: string,
    key?: string,
};

export interface Input {
    confirm(confirmation: Confirmation): Promise<boolean>;
    select<T>(selection: Selection<T>): Promise<T>;
    selectMultiple<T>(selection: MultipleSelection<T>): Promise<T[]>;
    prompt(prompt: Prompt): Promise<string>;
    wait(wait: Wait): Promise<string>;
}
