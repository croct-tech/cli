import prompts, {Options, PromptObject} from 'prompts';
import {Readable, Writable} from 'stream';
import {Confirmation, Input, MultipleSelection, Prompt, Selection, Wait} from '@/application/cli/io/input';

type PromptState = {
    value: string,
    aborted: boolean,
};

type PromptInstance = {
    value: string,
    error: boolean,
    errorMsg: string,
    reset(): void,
    submit(): Promise<void>,
    bell(): void,
};

export type AbortCallback = () => never;

export type Configuration = {
    input: Readable,
    output: Writable,
    onAbort: AbortCallback,
    onInteractionStart?: () => void,
    onInteractionEnd?: () => void,
};

type PromptDefinition<T extends string> = Omit<PromptObject<T>, 'onState' | 'name' | 'stdin' | 'stdout'> & {
    onState?: (this: PromptInstance, state: PromptState) => void,
    onAbort?: AbortCallback,
};

export class ConsoleInput implements Input {
    private readonly configuration: Configuration;

    public constructor(configuration: Configuration) {
        this.configuration = configuration;
    }

    public prompt(prompt: Prompt): Promise<string> {
        return this.interact({
            type: prompt.type === 'password' ? 'invisible' : 'text',
            message: prompt.message,
            initial: prompt.default,
            validate: prompt.validate,
        });
    }

    public select<T>(selection: Selection<T>): Promise<T> {
        const initial = selection.default !== undefined
            ? selection.options.findIndex(option => option.value === selection.default)
            : -1;

        return this.interact({
            type: selection.options.length > 10 ? 'autocomplete' : 'select',
            instructions: false,
            message: selection.message,
            choices: selection.options.map(
                option => ({
                    title: option.label,
                    value: option.value,
                    disabled: option.disabled,
                }),
            ),
            initial: initial === -1 ? undefined : initial,
        });
    }

    public selectMultiple<T>(selection: MultipleSelection<T>): Promise<T[]> {
        return this.interact({
            type: selection.options.length > 10 ? 'autocompleteMultiselect' : 'multiselect',
            hint: '<space> to select. <a> to toggle all. <enter> to submit.',
            message: selection.message,
            instructions: false,
            min: selection.min,
            max: selection.max,
            choices: selection.options.map(
                option => ({
                    title: option.label,
                    value: option.value,
                    disabled: option.disabled,
                    selected: option.selected,
                }),
            ),
        });
    }

    public confirm(confirmation: Confirmation): Promise<boolean> {
        return this.interact({
            type: 'confirm',
            message: confirmation.message,
            initial: confirmation.default ?? false,
        });
    }

    public wait(wait: Wait): Promise<string> {
        const keys = {
            enter: '[enter]',
            space: '[space]',
        };

        const values: Record<string, string> = {
            [keys.enter]: '',
            [keys.space]: ' ',
        };

        const errorMessage = `Press <${wait.key}> to continue`;

        const keyValue = wait.key !== undefined
            ? values[wait.key] ?? wait.key
            : undefined;

        let submitted = false;

        return this.interact(
            {
                type: 'invisible',
                message: wait.message,
                validate: value => (
                    (keyValue === undefined || value === keyValue)
                        ? true
                        : errorMessage
                ),
                onState: function onState(state: PromptState): void {
                    if (submitted) {
                        return;
                    }

                    if (state.value === '') {
                        if (this.error && wait.key !== keys.enter) {
                            this.bell();
                        }

                        return;
                    }

                    if (keyValue === undefined || state.value === keyValue) {
                        submitted = true;
                        this.submit();
                    } else {
                        this.bell();
                        this.reset();

                        if (keyValue !== undefined) {
                            this.error = true;
                            this.errorMsg = errorMessage;
                        }
                    }
                },
            },
        );
    }

    private async interact<T extends string, R>(definition: PromptDefinition<T>, options?: Options): Promise<R> {
        this.configuration.onInteractionStart?.();
        const {output, onAbort} = this.configuration;

        const questions = {
            name: 'value',
            ...definition,
            stdin: this.configuration.input,
            stdout: this.configuration.output,
            onState: function onState(this: PromptInstance, state: PromptState): void {
                definition.onState?.apply(this, [state]);

                if (state.aborted) {
                    definition.onAbort?.();

                    // If we don't re-enable the terminal cursor before exiting
                    // the program, the cursor will remain hidden
                    output.write('\x1B[?25h');
                    output.write('\n');
                    onAbort();
                }
            },
        };

        try {
            return await prompts(questions, options).then(response => response.value);
        } finally {
            this.configuration.onInteractionEnd?.();
        }
    }
}
