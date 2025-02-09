import {Confirmation, Input, MultipleSelection, Prompt, Selection, Wait} from '@/application/cli/io/input';

export class DefaultChoiceInput implements Input {
    private readonly input: Input;

    public constructor(input: Input) {
        this.input = input;
    }

    public confirm(confirmation: Confirmation): Promise<boolean> {
        if (confirmation.default !== undefined) {
            return Promise.resolve(confirmation.default);
        }

        return this.input.confirm(confirmation);
    }

    public prompt(prompt: Prompt): Promise<string> {
        if (prompt.default !== undefined) {
            return Promise.resolve(prompt.default);
        }

        return this.input.prompt(prompt);
    }

    public select<T>(selection: Selection<T>): Promise<T> {
        if (selection.default !== undefined) {
            return Promise.resolve(selection.default);
        }

        return this.input.select(selection);
    }

    public selectMultiple<T>(selection: MultipleSelection<T>): Promise<T[]> {
        const defaultOptions = selection.options.filter(option => option.selected === true);

        if (defaultOptions.length > 0 && (selection.min === undefined || defaultOptions.length >= selection.min)) {
            return Promise.resolve(defaultOptions.map(option => option.value));
        }

        return this.input.selectMultiple(selection);
    }

    public wait(wait: Wait): Promise<string> {
        return this.input.wait(wait);
    }
}
