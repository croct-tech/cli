import {JsonValue} from '@croct/json';
import {Action, ActionError} from '@/application/template/action/action';
import {ActionContext} from '@/application/template/action/context';
import {Confirmation, Input, MultipleSelection, Prompt, Selection} from '@/application/cli/io/input';
import {ErrorReason} from '@/application/error';

export type ConfirmationOptions = Confirmation;

export type ChoiceOptions = Selection<JsonValue>;

export type MultipleChoiceOptions = MultipleSelection<JsonValue>;

export type TextOptions = Omit<Prompt, 'validate'>;

type PromptDefinitionMap = {
    confirmation: ConfirmationOptions,
    choice: ChoiceOptions,
    'multi-choice': MultipleChoiceOptions,
    text: TextOptions,
};

type PromptDefinition = {
    [K in keyof PromptDefinitionMap]: PromptDefinitionMap[K] & {
        type: K,
    }
}[keyof PromptDefinitionMap];

export type PromptOptions = PromptDefinition & {
    output: string,
};

export class PromptAction implements Action<PromptOptions> {
    public async execute(options: PromptOptions, context: ActionContext): Promise<void> {
        const {input} = context;

        const answer = input === undefined
            ? this.getDefaultValue(options)
            : await this.prompt(options, input);

        if (answer === undefined) {
            throw new ActionError('Action requires user input.', {
                reason: ErrorReason.PRECONDITION,
                suggestions: [
                    'Retry in interactive mode',
                ],
            });
        }

        context.set(options.output, answer);
    }

    private getDefaultValue(options: PromptDefinition): JsonValue|undefined {
        switch (options.type) {
            case 'confirmation':
                return options.default;

            case 'choice':
                return options.default;

            case 'multi-choice': {
                const values = options.options.flatMap(option => (option.selected === true ? [option.value] : []));

                if (values.length === 0) {
                    return undefined;
                }

                return values;
            }

            case 'text':
                return options.default;
        }
    }

    private prompt(options: PromptDefinition, input: Input): Promise<JsonValue> {
        switch (options.type) {
            case 'confirmation':
                return input.confirm(options);

            case 'choice':
                return input.select(options);

            case 'multi-choice':
                return input.selectMultiple(options);

            case 'text':
                return input.prompt(options);
        }
    }
}
