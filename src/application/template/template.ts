import {ActionDefinition} from '@/application/template/action/action';

type OptionTypes = {
    string: {
        default?: string,
        choices?: string[],
    },
    boolean: {
        default?: boolean,
    },
    number: {
        default?: number,
    },
};

export type OptionType = keyof OptionTypes;

export type OptionDefinition<T extends OptionType = OptionType> = {
    [K in T]: OptionTypes[K] & {
        type: K,
        description: string,
        required?: boolean,
    }
}[T];

export type OptionMap = Record<string, OptionDefinition>;

export type Template = {
    title: string,
    description: string,
    actions: ActionDefinition[],
    options?: OptionMap,
};
