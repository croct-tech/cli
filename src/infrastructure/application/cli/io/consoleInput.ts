import prompts, {Options, PromptObject} from 'prompts';
import {Readable, Writable} from 'stream';
import {Confirmation, Input, Prompt, Selection} from '@/application/cli/io/input';

type PromptState = {
    aborted: boolean,
};

export type AbortCallback = () => never;

export type Configuration = {
    input: Readable,
    output: Writable,
    onAbort: AbortCallback,
    onInteractionStart?: () => void,
    onInteractionEnd?: () => void,
};

type PromptDefinition<T extends string> = Omit<PromptObject<T>, 'onState' | 'name' | 'stdin' | 'stdout'>;

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
            message: selection.message,
            choices: selection.options.map(
                option => ({
                    title: option.label,
                    value: option.value,
                }),
            ),
            initial: initial === -1 ? undefined : initial,
        });
    }

    public confirm(confirmation: Confirmation): Promise<boolean> {
        return this.interact({
            type: 'toggle',
            message: confirmation.message,
            active: 'yes',
            inactive: 'no',
            initial: confirmation.default ?? true,
        });
    }

    private async interact<T extends string, R>(definition: PromptDefinition<T>, options?: Options): Promise<R> {
        this.configuration.onInteractionStart?.();

        const questions = {
            name: 'value',
            ...definition,
            stdin: this.configuration.input,
            stdout: this.configuration.output,
            onState: (state: PromptState): void => {
                if (state.aborted) {
                    const {output, onAbort} = this.configuration;

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
