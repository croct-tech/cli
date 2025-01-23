import {JsonObject, JsonValue} from '@croct/json';
import {VariableMap} from '@/application/template/evaluation';

type ResolvedOptionValue = string|number|boolean|Array<string|number|boolean>;

type LazyOptionValue<T extends ResolvedOptionValue> = () => Promise<T>|T;

export type OptionValue<T extends ResolvedOptionValue = ResolvedOptionValue> = T|LazyOptionValue<T>;

type OptionTypes = {
    string: {
        type: string,
        choices?: string[],
    },
    boolean: {
        type: boolean,
    },
    number: {
        type: number,
    },
    array: {
        type: Array<string|number|boolean>,
    },
};

export type OptionType = keyof OptionTypes;

export type OptionDefinition<T extends OptionType = OptionType> = {
    [K in T]: Omit<OptionTypes[K], 'type'> & {
        type: K,
        default?: OptionValue<OptionTypes[K]['type']>,
        description: string,
        required?: boolean,
    }
}[T];

export type OptionMap = Record<string, OptionDefinition>;

export type ActionDefinition = {
    [key: string]: unknown,
    name: string,
};

export type Template = {
    title?: string,
    description?: string,
    options?: OptionMap,
    actions: ActionDefinition[],
};

export type DeferredActionDefinition = {
    name: string,
    resolve(variables: VariableMap): Promise<JsonObject>,
};

export type DeferredOptionDefinition = {
    [K in OptionType]: Omit<OptionDefinition<K>, 'default'> & {
        resolveDefault?: (variables: VariableMap) => Promise<JsonValue>,
    }
}[OptionType];

export type DeferredTemplate = Omit<Template, 'actions' | 'options'> & {
    actions: DeferredActionDefinition[],
    options?: Record<string, DeferredOptionDefinition>,
};
