import {SourceLocation} from './location';

export enum JsonTokenType {
    OBJECT_START = 'OBJECT_START',
    OBJECT_END = 'OBJECT_END',
    ARRAY_START = 'ARRAY_START',
    ARRAY_END = 'ARRAY_END',
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    BOOLEAN = 'BOOLEAN',
    NULL = 'NULL',
    COLON = 'COLON',
    COMMA = 'COMMA',
    WHITESPACE = 'WHITESPACE',
    NEW_LINE = 'NEW_LINE',
    EOF = 'EOF',
}

export type JsonPrimitiveTokenType =
    JsonTokenType.STRING
    | JsonTokenType.NUMBER
    | JsonTokenType.BOOLEAN
    | JsonTokenType.NULL;

export type JsonPrimitiveValue<T extends JsonPrimitiveTokenType> = {
    [JsonTokenType.STRING]: string,
    [JsonTokenType.NUMBER]: number,
    [JsonTokenType.BOOLEAN]: boolean,
    [JsonTokenType.NULL]: null,
}[T];

export type JsonToken<T extends JsonTokenType = JsonTokenType> = {
    readonly type: T,
    readonly value: string,
    readonly location: SourceLocation,
};
