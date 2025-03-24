/* eslint-disable no-template-curly-in-string -- False positive */
import {JsonPrimitiveNode, JsonTokenNode, JsonTokenType, SourcePosition} from '@croct/json5-parser';
import {Fragment, JsonExpressionNode, TemplateStringParser} from '@/application/template/templateStringParser';
import {Help, HelpfulError} from '@/application/error';

describe('A template string parser', () => {
    type ValidScenario = {
        input: string|JsonExpressionNode,
        position?: SourcePosition,
        fragments: Fragment[],
    };

    it.each<ValidScenario>([
        {
            input: 'Hello, world!',
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, world!',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 13,
                            line: 1,
                            column: 14,
                        },
                    },
                },
            ],
        },
        {
            input: 'Hello, world!',
            position: {
                index: 20,
                line: 2,
                column: 1,
            },
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, world!',
                    location: {
                        start: {
                            index: 20,
                            line: 2,
                            column: 1,
                        },
                        end: {
                            index: 33,
                            line: 2,
                            column: 14,
                        },
                    },
                },
            ],
        },
        {
            input: new JsonPrimitiveNode({
                value: 'Hello, world!',
                token: new JsonTokenNode({
                    type: JsonTokenType.STRING,
                    value: '"Hello, world!"',
                    location: {
                        start: {
                            index: 10,
                            line: 2,
                            column: 1,
                        },
                        end: {
                            index: 23,
                            line: 2,
                            column: 14,
                        },
                    },
                }),
                location: {
                    start: {
                        index: 10,
                        line: 2,
                        column: 1,
                    },
                    end: {
                        index: 23,
                        line: 2,
                        column: 14,
                    },
                },
            }),
            position: {
                index: 10,
                line: 2,
                column: 1,
            },
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, world!',
                    location: {
                        start: {
                            index: 10,
                            line: 2,
                            column: 1,
                        },
                        end: {
                            index: 23,
                            line: 2,
                            column: 14,
                        },
                    },
                },
            ],
        },
        {
            input: 'Hello,\nworld!',
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello,\nworld!',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 13,
                            line: 2,
                            column: 7,
                        },
                    },
                },
            ],
        },
        {
            input: 'Hello, "${world}"!',
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, "',
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
                {
                    type: 'expression',
                    source: '${world}',
                    expression: 'world',
                    location: {
                        start: {
                            index: 8,
                            line: 1,
                            column: 9,
                        },
                        end: {
                            index: 16,
                            line: 1,
                            column: 17,
                        },
                    },
                },
                {
                    type: 'literal',
                    source: '"!',
                    location: {
                        start: {
                            index: 16,
                            line: 1,
                            column: 17,
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
            input: 'Hello, "${"world"}"!',
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, "',
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
                {
                    type: 'expression',
                    source: '${"world"}',
                    expression: '"world"',
                    location: {
                        start: {
                            index: 8,
                            line: 1,
                            column: 9,
                        },
                        end: {
                            index: 18,
                            line: 1,
                            column: 19,
                        },
                    },
                },
                {
                    type: 'literal',
                    source: '"!',
                    location: {
                        start: {
                            index: 18,
                            line: 1,
                            column: 19,
                        },
                        end: {
                            index: 20,
                            line: 1,
                            column: 21,
                        },
                    },
                },
            ],
        },
        {
            input: "Hello, '${world}'!",
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, \'',
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
                {
                    type: 'expression',
                    source: '${world}',
                    expression: 'world',
                    location: {
                        start: {
                            index: 8,
                            line: 1,
                            column: 9,
                        },
                        end: {
                            index: 16,
                            line: 1,
                            column: 17,
                        },
                    },
                },
                {
                    type: 'literal',
                    source: '\'!',
                    location: {
                        start: {
                            index: 16,
                            line: 1,
                            column: 17,
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
            input: "Hello, '${'world'}'!",
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, \'',
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
                {
                    type: 'expression',
                    source: '${\'world\'}',
                    expression: '\'world\'',
                    location: {
                        start: {
                            index: 8,
                            line: 1,
                            column: 9,
                        },
                        end: {
                            index: 18,
                            line: 1,
                            column: 19,
                        },
                    },
                },
                {
                    type: 'literal',
                    source: '\'!',
                    location: {
                        start: {
                            index: 18,
                            line: 1,
                            column: 19,
                        },
                        end: {
                            index: 20,
                            line: 1,
                            column: 21,
                        },
                    },
                },
            ],
        },
        {
            input: 'Hello, "world"!',
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, "world"!',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 15,
                            line: 1,
                            column: 16,
                        },
                    },
                },
            ],
        },
        {
            input: 'Hello, ${"world"}',
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, ',
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
                {
                    type: 'expression',
                    source: '${"world"}',
                    expression: '"world"',
                    location: {
                        start: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                        end: {
                            index: 17,
                            line: 1,
                            column: 18,
                        },
                    },
                },
            ],
        },
        {
            input: '${"Hello"}, world!',
            fragments: [
                {
                    type: 'expression',
                    source: '${"Hello"}',
                    expression: '"Hello"',
                    location: {
                        start: {
                            index: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            index: 10,
                            line: 1,
                            column: 11,
                        },
                    },
                },
                {
                    type: 'literal',
                    source: ', world!',
                    location: {
                        start: {
                            index: 10,
                            line: 1,
                            column: 11,
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
            input: 'Hello, ${true} world!',
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, ',
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
                {
                    type: 'expression',
                    source: '${true}',
                    expression: 'true',
                    location: {
                        start: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                        end: {
                            index: 14,
                            line: 1,
                            column: 15,
                        },
                    },
                },
                {
                    type: 'literal',
                    source: ' world!',
                    location: {
                        start: {
                            index: 14,
                            line: 1,
                            column: 15,
                        },
                        end: {
                            index: 21,
                            line: 1,
                            column: 22,
                        },
                    },
                },
            ],
        },
        {
            input: 'Hello, ${\'}}\' + "}}}}"} world!',
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, ',
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
                {
                    type: 'expression',
                    source: '${\'}}\' + "}}}}"}',
                    expression: '\'}}\' + "}}}}"',
                    location: {
                        start: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                        end: {
                            index: 23,
                            line: 1,
                            column: 24,
                        },
                    },
                },
                {
                    type: 'literal',
                    source: ' world!',
                    location: {
                        start: {
                            index: 23,
                            line: 1,
                            column: 24,
                        },
                        end: {
                            index: 30,
                            line: 1,
                            column: 31,
                        },
                    },
                },
            ],
        },
        {
            input: 'Hello, ${\'\\\'"\' + "\\"\'"} world!',
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, ',
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
                {
                    type: 'expression',
                    source: '${\'\\\'"\' + "\\"\'"}',
                    expression: '\'\\\'"\' + "\\"\'"',
                    location: {
                        start: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                        end: {
                            index: 23,
                            line: 1,
                            column: 24,
                        },
                    },
                },
                {
                    type: 'literal',
                    source: ' world!',
                    location: {
                        start: {
                            index: 23,
                            line: 1,
                            column: 24,
                        },
                        end: {
                            index: 30,
                            line: 1,
                            column: 31,
                        },
                    },
                },
            ],
        },
        {
            input: 'Hello, ${ foo({bar: "baz"}) } world!',
            fragments: [
                {
                    type: 'literal',
                    source: 'Hello, ',
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
                {
                    type: 'expression',
                    source: '${ foo({bar: "baz"}) }',
                    expression: 'foo({bar: "baz"})',
                    location: {
                        start: {
                            index: 7,
                            line: 1,
                            column: 8,
                        },
                        end: {
                            index: 29,
                            line: 1,
                            column: 30,
                        },
                    },
                },
                {
                    type: 'literal',
                    source: ' world!',
                    location: {
                        start: {
                            index: 29,
                            line: 1,
                            column: 30,
                        },
                        end: {
                            index: 36,
                            line: 1,
                            column: 37,
                        },
                    },
                },
            ],
        },
    ])('should parse $input', ({input, position, fragments}) => {
        expect(TemplateStringParser.parse(input, position)).toEqual(fragments);
    });

    type InvalidScenario = {
        input: string,
        error: Help & {
            message: string,
        },
    };

    it.each<InvalidScenario>([
        {
            input: 'Hello, ${world!',
            error: {
                message: 'Unbalanced braces in template string.',
                details: [
                    'Location: line 1, column 8',
                ],
            },
        },
        {
            input: 'Hello, ${"world}',
            error: {
                message: 'Unbalanced quotes in template string.',
                details: [
                    'Location: line 1, column 8',
                ],
            },
        },
        {
            input: "Hello, ${'world}",
            error: {
                message: 'Unbalanced quotes in template string.',
                details: [
                    'Location: line 1, column 8',
                ],
            },
        },
        {
            input: "Hello, ${'world\"}",
            error: {
                message: 'Unbalanced quotes in template string.',
                details: [
                    'Location: line 1, column 8',
                ],
            },
        },
        {
            input: "Hello, ${\"world'}",
            error: {
                message: 'Unbalanced quotes in template string.',
                details: [
                    'Location: line 1, column 8',
                ],
            },
        },
    ])('should throw an error for $input', ({input, error: {message, ...help}}) => {
        let expectedError: unknown;

        try {
            TemplateStringParser.parse(input);
        } catch (error) {
            expectedError = error;
        }

        expect(expectedError).toBeInstanceOf(HelpfulError);

        const helpfulError = expectedError as HelpfulError;

        expect(helpfulError.message).toBe(message);
        expect(helpfulError.help).toEqual(help);
    });
});
