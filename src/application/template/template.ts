import {JsonArray, JsonObject, JsonValue} from '@croct/json';
import {VariableMap} from '@/application/template/evaluation';
import {Deferrable} from '@/application/template/deferral';

type LazyOptionValue<T extends JsonValue> = () => Promise<T> | T;

export type OptionValue<T extends JsonValue = JsonValue> = T | LazyOptionValue<T>;

type OptionTypes = {
    reference: {
        type: string,
    },
    string: {
        type: string,
        options?: string[],
    },
    boolean: {
        type: boolean,
    },
    number: {
        type: number,
    },
    array: {
        type: JsonArray,
    },
    object: {
        type: JsonObject,
    },
};

export type OptionType = keyof OptionTypes;

export type OptionValueType<T extends OptionType> = OptionTypes[T]['type'];

export type OptionDefinition<T extends OptionType = OptionType> = {
    [K in T]: Omit<OptionTypes[K], 'type'> & {
    type: K,
    default?: OptionValueType<K>,
    description: string,
    required?: boolean,
}
}[T];

export type SourcePosition = {
    index: number,
    line: number,
    column: number,
};

export type SourceLocation = {
    url: URL,
    start: SourcePosition,
    end: SourcePosition,
};

export namespace SourceLocation {
    const key = Symbol('source');

    export function get(value: Record<PropertyKey, any>): SourceLocation|null {
        return value[key] ?? null;
    }

    export function set(value: Record<PropertyKey, any>, location: SourceLocation): void {
        // eslint-disable-next-line no-param-reassign -- Edit in place
        value[key] = location;
    }
}

export type OptionMap = Record<string, OptionDefinition>;

export type ActionDefinition = {
    name: string,
    [key: string]: unknown,
};

export type Template = {
    $schema?: string,
    title?: string,
    description?: string,
    options?: OptionMap,
    actions: ActionDefinition[],
};

export type DeferredActionDefinition = {
    resolve(variables: VariableMap): Deferrable<JsonValue>,
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
