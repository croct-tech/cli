import {JsonLexer} from './lexer';
import {JsonToken, JsonTokenType} from './token';
import {SourcePosition} from '@/infrastructure/json/location';

describe('Lexer', () => {
    type Scenario = {
        input: string,
        tokens: JsonToken[],
    };

    it.each<Scenario>([
        {
            input: '\r    {}\r\n    ',
            tokens: [
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '\r    ',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 5,
                            line: 1,
                            column: 6,
                        },
                    },
                },
                {
                    type: JsonTokenType.OBJECT_START,
                    value: '{',
                    location: {
                        start: {
                            index: 5,
                            line: 1,
                            column: 6,
                        },
                        end: {
                            index: 6,
                            line: 1,
                            column: 7,
                        },
                    },
                },
                {
                    type: JsonTokenType.OBJECT_END,
                    value: '}',
                    location: {
                        start: {
                            index: 6,
                            line: 1,
                            column: 7,
                        },
                        end: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\r\n',
                    location: {
                        start: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                        end: {
                            index: 9,
                            line: 2,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '    ',
                    location: {
                        start: {
                            index: 9,
                            line: 2,
                            column: 1,
                        },
                        end: {
                            index: 13,
                            line: 2,
                            column: 5,
                        },
                    },
                },
            ],
        },
        {
            input: 'true',
            tokens: [
                {
                    type: JsonTokenType.BOOLEAN,
                    value: 'true',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 4,
                            line: 1,
                            column: 5,
                        },
                    },
                },
            ],
        },
        {
            input: 'false',
            tokens: [
                {
                    type: JsonTokenType.BOOLEAN,
                    value: 'false',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 5,
                            line: 1,
                            column: 6,
                        },
                    },
                },
            ],
        },
        {
            input: 'null',
            tokens: [
                {
                    type: JsonTokenType.NULL,
                    value: 'null',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 4,
                            line: 1,
                            column: 5,
                        },
                    },
                },
            ],
        },
        {
            input: '42',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '42',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 2,
                            line: 1,
                            column: 3,
                        },
                    },
                },
            ],
        },
        {
            input: '-42',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '-42',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 3,
                            line: 1,
                            column: 4,
                        },
                    },
                },
            ],
        },
        {
            input: '42.3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '42.3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 4,
                            line: 1,
                            column: 5,
                        },
                    },
                },
            ],
        },
        {
            input: '-42.3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '-42.3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 5,
                            line: 1,
                            column: 6,
                        },
                    },
                },
            ],
        },
        {
            input: '42e3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '42e3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 4,
                            line: 1,
                            column: 5,
                        },
                    },
                },
            ],
        },
        {
            input: '42e+3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '42e+3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 5,
                            line: 1,
                            column: 6,
                        },
                    },
                },
            ],
        },
        {
            input: '42e-3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '42e-3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 5,
                            line: 1,
                            column: 6,
                        },
                    },
                },
            ],
        },
        {
            input: '42.3e3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '42.3e3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 6,
                            line: 1,
                            column: 7,
                        },
                    },
                },
            ],
        },
        {
            input: '42.3e+3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '42.3e+3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                    },
                },
            ],
        },
        {
            input: '42.3e-3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '42.3e-3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                    },
                },
            ],
        },
        {
            input: '-42e3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '-42e3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 5,
                            line: 1,
                            column: 6,
                        },
                    },
                },
            ],
        },
        {
            input: '-42e+3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '-42e+3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 6,
                            line: 1,
                            column: 7,
                        },
                    },
                },
            ],
        },
        {
            input: '-42e-3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '-42e-3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 6,
                            line: 1,
                            column: 7,
                        },
                    },
                },
            ],
        },
        {
            input: '-42.3e3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '-42.3e3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                    },
                },
            ],
        },
        {
            input: '-42.3e+3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '-42.3e+3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 8,
                            line: 1,
                            column: 9,
                        },
                    },
                },
            ],
        },
        {
            input: '42.3e-3',
            tokens: [
                {
                    type: JsonTokenType.NUMBER,
                    value: '42.3e-3',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                    },
                },
            ],
        },
        {
            input: '"value"',
            tokens: [
                {
                    type: JsonTokenType.STRING,
                    value: '"value"',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                    },
                },
            ],
        },
        {
            input: '"\\\\value\\""',
            tokens: [
                {
                    type: JsonTokenType.STRING,
                    value: '"\\\\value\\""',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 11,
                            line: 1,
                            column: 12,
                        },
                    },
                },
            ],
        },
        {
            input: '{}',
            tokens: [
                {
                    type: JsonTokenType.OBJECT_START,
                    value: '{',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                    },
                },
                {
                    type: JsonTokenType.OBJECT_END,
                    value: '}',
                    location: {
                        start: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            index: 2,
                            line: 1,
                            column: 3,
                        },
                    },
                },
            ],
        },
        {
            input: '{"key": "value"}',
            tokens: [
                {
                    type: JsonTokenType.OBJECT_START,
                    value: '{',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"key"',
                    location: {
                        start: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            index: 6,
                            line: 1,
                            column: 7,
                        },
                    },
                },
                {
                    type: JsonTokenType.COLON,
                    value: ':',
                    location: {
                        start: {
                            index: 6,
                            line: 1,
                            column: 7,
                        },
                        end: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: ' ',
                    location: {
                        start: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                        end: {
                            index: 8,
                            line: 1,
                            column: 9,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"value"',
                    location: {
                        start: {
                            index: 8,
                            line: 1,
                            column: 9,
                        },
                        end: {
                            index: 15,
                            line: 1,
                            column: 16,
                        },
                    },
                },
                {
                    type: JsonTokenType.OBJECT_END,
                    value: '}',
                    location: {
                        start: {
                            index: 15,
                            line: 1,
                            column: 16,
                        },
                        end: {
                            index: 16,
                            line: 1,
                            column: 17,
                        },
                    },
                },
            ],
        },
        {
            input: '{"\\"key": "value"}',
            tokens: [
                {
                    type: JsonTokenType.OBJECT_START,
                    value: '{',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"\\"key"',
                    location: {
                        start: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            index: 8,
                            line: 1,
                            column: 9,
                        },
                    },
                },
                {
                    type: JsonTokenType.COLON,
                    value: ':',
                    location: {
                        start: {
                            index: 8,
                            line: 1,
                            column: 9,
                        },
                        end: {
                            index: 9,
                            line: 1,
                            column: 10,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: ' ',
                    location: {
                        start: {
                            index: 9,
                            line: 1,
                            column: 10,
                        },
                        end: {
                            index: 10,
                            line: 1,
                            column: 11,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"value"',
                    location: {
                        start: {
                            index: 10,
                            line: 1,
                            column: 11,
                        },
                        end: {
                            index: 17,
                            line: 1,
                            column: 18,
                        },
                    },
                },
                {
                    type: JsonTokenType.OBJECT_END,
                    value: '}',
                    location: {
                        start: {
                            index: 17,
                            line: 1,
                            column: 18,
                        },
                        end: {
                            index: 18,
                            line: 1,
                            column: 19,
                        },
                    },
                },
            ],
        },
        {
            input: '{\n}',
            tokens: [
                {
                    type: JsonTokenType.OBJECT_START,
                    value: '{',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            index: 2,
                            line: 2,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.OBJECT_END,
                    value: '}',
                    location: {
                        start: {
                            index: 2,
                            line: 2,
                            column: 1,
                        },
                        end: {
                            index: 3,
                            line: 2,
                            column: 2,
                        },
                    },
                },
            ],
        },
        {
            input: '{\r\n}',
            tokens: [
                {
                    type: JsonTokenType.OBJECT_START,
                    value: '{',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\r\n',
                    location: {
                        start: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            index: 3,
                            line: 2,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.OBJECT_END,
                    value: '}',
                    location: {
                        start: {
                            index: 3,
                            line: 2,
                            column: 1,
                        },
                        end: {
                            index: 4,
                            line: 2,
                            column: 2,
                        },
                    },
                },
            ],
        },
        {
            input: '[]',
            tokens: [
                {
                    type: JsonTokenType.ARRAY_START,
                    value: '[',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                    },
                },
                {
                    type: JsonTokenType.ARRAY_END,
                    value: ']',
                    location: {
                        start: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            index: 2,
                            line: 1,
                            column: 3,
                        },
                    },
                },
            ],
        },
        // All together
        {
            input: JSON.stringify(
                {
                    string: 'value',
                    number: 42,
                    boolean: true,
                    null: null,
                    object: {
                        key: 'value',
                    },
                    array: [
                        'value',
                    ],
                },
                null,
                2,
            ),
            tokens: [
                {
                    type: JsonTokenType.OBJECT_START,
                    value: '{',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            index: 2,
                            line: 2,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '  ',
                    location: {
                        start: {
                            index: 2,
                            line: 2,
                            column: 1,
                        },
                        end: {
                            index: 4,
                            line: 2,
                            column: 3,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"string"',
                    location: {
                        start: {
                            index: 4,
                            line: 2,
                            column: 3,
                        },
                        end: {
                            index: 12,
                            line: 2,
                            column: 11,
                        },
                    },
                },
                {
                    type: JsonTokenType.COLON,
                    value: ':',
                    location: {
                        start: {
                            index: 12,
                            line: 2,
                            column: 11,
                        },
                        end: {
                            index: 13,
                            line: 2,
                            column: 12,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: ' ',
                    location: {
                        start: {
                            index: 13,
                            line: 2,
                            column: 12,
                        },
                        end: {
                            index: 14,
                            line: 2,
                            column: 13,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"value"',
                    location: {
                        start: {
                            index: 14,
                            line: 2,
                            column: 13,
                        },
                        end: {
                            index: 21,
                            line: 2,
                            column: 20,
                        },
                    },
                },
                {
                    type: JsonTokenType.COMMA,
                    value: ',',
                    location: {
                        start: {
                            index: 21,
                            line: 2,
                            column: 20,
                        },
                        end: {
                            index: 22,
                            line: 2,
                            column: 21,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 22,
                            line: 2,
                            column: 21,
                        },
                        end: {
                            index: 23,
                            line: 3,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '  ',
                    location: {
                        start: {
                            index: 23,
                            line: 3,
                            column: 1,
                        },
                        end: {
                            index: 25,
                            line: 3,
                            column: 3,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"number"',
                    location: {
                        start: {
                            index: 25,
                            line: 3,
                            column: 3,
                        },
                        end: {
                            index: 33,
                            line: 3,
                            column: 11,
                        },
                    },
                },
                {
                    type: JsonTokenType.COLON,
                    value: ':',
                    location: {
                        start: {
                            index: 33,
                            line: 3,
                            column: 11,
                        },
                        end: {
                            index: 34,
                            line: 3,
                            column: 12,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: ' ',
                    location: {
                        start: {
                            index: 34,
                            line: 3,
                            column: 12,
                        },
                        end: {
                            index: 35,
                            line: 3,
                            column: 13,
                        },
                    },
                },
                {
                    type: JsonTokenType.NUMBER,
                    value: '42',
                    location: {
                        start: {
                            index: 35,
                            line: 3,
                            column: 13,
                        },
                        end: {
                            index: 37,
                            line: 3,
                            column: 15,
                        },
                    },
                },
                {
                    type: JsonTokenType.COMMA,
                    value: ',',
                    location: {
                        start: {
                            index: 37,
                            line: 3,
                            column: 15,
                        },
                        end: {
                            index: 38,
                            line: 3,
                            column: 16,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 38,
                            line: 3,
                            column: 16,
                        },
                        end: {
                            index: 39,
                            line: 4,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '  ',
                    location: {
                        start: {
                            index: 39,
                            line: 4,
                            column: 1,
                        },
                        end: {
                            index: 41,
                            line: 4,
                            column: 3,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"boolean"',
                    location: {
                        start: {
                            index: 41,
                            line: 4,
                            column: 3,
                        },
                        end: {
                            index: 50,
                            line: 4,
                            column: 12,
                        },
                    },
                },
                {
                    type: JsonTokenType.COLON,
                    value: ':',
                    location: {
                        start: {
                            index: 50,
                            line: 4,
                            column: 12,
                        },
                        end: {
                            index: 51,
                            line: 4,
                            column: 13,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: ' ',
                    location: {
                        start: {
                            index: 51,
                            line: 4,
                            column: 13,
                        },
                        end: {
                            index: 52,
                            line: 4,
                            column: 14,
                        },
                    },
                },
                {
                    type: JsonTokenType.BOOLEAN,
                    value: 'true',
                    location: {
                        start: {
                            index: 52,
                            line: 4,
                            column: 14,
                        },
                        end: {
                            index: 56,
                            line: 4,
                            column: 18,
                        },
                    },
                },
                {
                    type: JsonTokenType.COMMA,
                    value: ',',
                    location: {
                        start: {
                            index: 56,
                            line: 4,
                            column: 18,
                        },
                        end: {
                            index: 57,
                            line: 4,
                            column: 19,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 57,
                            line: 4,
                            column: 19,
                        },
                        end: {
                            index: 58,
                            line: 5,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '  ',
                    location: {
                        start: {
                            index: 58,
                            line: 5,
                            column: 1,
                        },
                        end: {
                            index: 60,
                            line: 5,
                            column: 3,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"null"',
                    location: {
                        start: {
                            index: 60,
                            line: 5,
                            column: 3,
                        },
                        end: {
                            index: 66,
                            line: 5,
                            column: 9,
                        },
                    },
                },
                {
                    type: JsonTokenType.COLON,
                    value: ':',
                    location: {
                        start: {
                            index: 66,
                            line: 5,
                            column: 9,
                        },
                        end: {
                            index: 67,
                            line: 5,
                            column: 10,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: ' ',
                    location: {
                        start: {
                            index: 67,
                            line: 5,
                            column: 10,
                        },
                        end: {
                            index: 68,
                            line: 5,
                            column: 11,
                        },
                    },
                },
                {
                    type: JsonTokenType.NULL,
                    value: 'null',
                    location: {
                        start: {
                            index: 68,
                            line: 5,
                            column: 11,
                        },
                        end: {
                            index: 72,
                            line: 5,
                            column: 15,
                        },
                    },
                },
                {
                    type: JsonTokenType.COMMA,
                    value: ',',
                    location: {
                        start: {
                            index: 72,
                            line: 5,
                            column: 15,
                        },
                        end: {
                            index: 73,
                            line: 5,
                            column: 16,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 73,
                            line: 5,
                            column: 16,
                        },
                        end: {
                            index: 74,
                            line: 6,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '  ',
                    location: {
                        start: {
                            index: 74,
                            line: 6,
                            column: 1,
                        },
                        end: {
                            index: 76,
                            line: 6,
                            column: 3,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"object"',
                    location: {
                        start: {
                            index: 76,
                            line: 6,
                            column: 3,
                        },
                        end: {
                            index: 84,
                            line: 6,
                            column: 11,
                        },
                    },
                },
                {
                    type: JsonTokenType.COLON,
                    value: ':',
                    location: {
                        start: {
                            index: 84,
                            line: 6,
                            column: 11,
                        },
                        end: {
                            index: 85,
                            line: 6,
                            column: 12,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: ' ',
                    location: {
                        start: {
                            index: 85,
                            line: 6,
                            column: 12,
                        },
                        end: {
                            index: 86,
                            line: 6,
                            column: 13,
                        },
                    },
                },
                {
                    type: JsonTokenType.OBJECT_START,
                    value: '{',
                    location: {
                        start: {
                            index: 86,
                            line: 6,
                            column: 13,
                        },
                        end: {
                            index: 87,
                            line: 6,
                            column: 14,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 87,
                            line: 6,
                            column: 14,
                        },
                        end: {
                            index: 88,
                            line: 7,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '    ',
                    location: {
                        start: {
                            index: 88,
                            line: 7,
                            column: 1,
                        },
                        end: {
                            index: 92,
                            line: 7,
                            column: 5,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"key"',
                    location: {
                        start: {
                            index: 92,
                            line: 7,
                            column: 5,
                        },
                        end: {
                            index: 97,
                            line: 7,
                            column: 10,
                        },
                    },
                },
                {
                    type: JsonTokenType.COLON,
                    value: ':',
                    location: {
                        start: {
                            index: 97,
                            line: 7,
                            column: 10,
                        },
                        end: {
                            index: 98,
                            line: 7,
                            column: 11,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: ' ',
                    location: {
                        start: {
                            index: 98,
                            line: 7,
                            column: 11,
                        },
                        end: {
                            index: 99,
                            line: 7,
                            column: 12,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"value"',
                    location: {
                        start: {
                            index: 99,
                            line: 7,
                            column: 12,
                        },
                        end: {
                            index: 106,
                            line: 7,
                            column: 19,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 106,
                            line: 7,
                            column: 19,
                        },
                        end: {
                            index: 107,
                            line: 8,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '  ',
                    location: {
                        start: {
                            index: 107,
                            line: 8,
                            column: 1,
                        },
                        end: {
                            index: 109,
                            line: 8,
                            column: 3,
                        },
                    },
                },
                {
                    type: JsonTokenType.OBJECT_END,
                    value: '}',
                    location: {
                        start: {
                            index: 109,
                            line: 8,
                            column: 3,
                        },
                        end: {
                            index: 110,
                            line: 8,
                            column: 4,
                        },
                    },
                },
                {
                    type: JsonTokenType.COMMA,
                    value: ',',
                    location: {
                        start: {
                            index: 110,
                            line: 8,
                            column: 4,
                        },
                        end: {
                            index: 111,
                            line: 8,
                            column: 5,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 111,
                            line: 8,
                            column: 5,
                        },
                        end: {
                            index: 112,
                            line: 9,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '  ',
                    location: {
                        start: {
                            index: 112,
                            line: 9,
                            column: 1,
                        },
                        end: {
                            index: 114,
                            line: 9,
                            column: 3,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"array"',
                    location: {
                        start: {
                            index: 114,
                            line: 9,
                            column: 3,
                        },
                        end: {
                            index: 121,
                            line: 9,
                            column: 10,
                        },
                    },
                },
                {
                    type: JsonTokenType.COLON,
                    value: ':',
                    location: {
                        start: {
                            index: 121,
                            line: 9,
                            column: 10,
                        },
                        end: {
                            index: 122,
                            line: 9,
                            column: 11,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: ' ',
                    location: {
                        start: {
                            index: 122,
                            line: 9,
                            column: 11,
                        },
                        end: {
                            index: 123,
                            line: 9,
                            column: 12,
                        },
                    },
                },
                {
                    type: JsonTokenType.ARRAY_START,
                    value: '[',
                    location: {
                        start: {
                            index: 123,
                            line: 9,
                            column: 12,
                        },
                        end: {
                            index: 124,
                            line: 9,
                            column: 13,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 124,
                            line: 9,
                            column: 13,
                        },
                        end: {
                            index: 125,
                            line: 10,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '    ',
                    location: {
                        start: {
                            index: 125,
                            line: 10,
                            column: 1,
                        },
                        end: {
                            index: 129,
                            line: 10,
                            column: 5,
                        },
                    },
                },
                {
                    type: JsonTokenType.STRING,
                    value: '"value"',
                    location: {
                        start: {
                            index: 129,
                            line: 10,
                            column: 5,
                        },
                        end: {
                            index: 136,
                            line: 10,
                            column: 12,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 136,
                            line: 10,
                            column: 12,
                        },
                        end: {
                            index: 137,
                            line: 11,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.WHITESPACE,
                    value: '  ',
                    location: {
                        start: {
                            index: 137,
                            line: 11,
                            column: 1,
                        },
                        end: {
                            index: 139,
                            line: 11,
                            column: 3,
                        },
                    },
                },
                {
                    type: JsonTokenType.ARRAY_END,
                    value: ']',
                    location: {
                        start: {
                            index: 139,
                            line: 11,
                            column: 3,
                        },
                        end: {
                            index: 140,
                            line: 11,
                            column: 4,
                        },
                    },
                },
                {
                    type: JsonTokenType.NEW_LINE,
                    value: '\n',
                    location: {
                        start: {
                            index: 140,
                            line: 11,
                            column: 4,
                        },
                        end: {
                            index: 141,
                            line: 12,
                            column: 1,
                        },
                    },
                },
                {
                    type: JsonTokenType.OBJECT_END,
                    value: '}',
                    location: {
                        start: {
                            index: 141,
                            line: 12,
                            column: 1,
                        },
                        end: {
                            index: 142,
                            line: 12,
                            column: 2,
                        },
                    },
                },
            ],
        },
    ])('should tokenize $input', ({input, tokens}) => {
        const lexer = new JsonLexer(input);

        const result = [...lexer];

        for (const token of result) {
            const {location} = token;

            expect(getSliceByIndex(location.start, location.end, input)).toEqual(token.value);
            expect(getSliceByLineAndColum(location.start, location.end, input)).toEqual(token.value);
        }

        expect(result).toEqual(tokens);
    });

    function getSliceByIndex(start: SourcePosition, end: SourcePosition, input: string): string {
        return input.slice(start.index, end.index);
    }

    function getSliceByLineAndColum(start: SourcePosition, end: SourcePosition, input: string): string {
        let startIndex = 0;
        let endIndex = 0;

        for (let index = 0, line = 1, column = 1; index <= input.length; index++) {
            if (line === start.line && column === start.column) {
                startIndex = index;
            }

            if (line === end.line && column === end.column) {
                endIndex = index;

                break;
            }

            if (input[index] === '\n') {
                line++;
                column = 1;
            } else {
                column++;
            }
        }

        return input.slice(startIndex, endIndex);
    }
});
