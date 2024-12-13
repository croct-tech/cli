import {JsonValue} from '@croct/json';
import {JsonParser} from './parser';
import {JsonIdentifierNode} from '@/infrastructure/json/node/identifierNode';
import {JsonObjectNode} from '@/infrastructure/json/node/objectNode';
import {JsonArrayNode} from '@/infrastructure/json/node/arrayNode';
import {JsonValueNode} from '@/infrastructure/json/node/valueNode';
import {Formatting} from '@/infrastructure/json/node/node';

describe('Functional test', () => {
    type ParseScenario = {
        input: string,
        expected: JsonValue,
    };

    it.each<ParseScenario>([
        {
            input: 'Infinity',
            expected: Infinity,
        },
        {
            input: '+Infinity',
            expected: Infinity,
        },
        {
            input: '-Infinity',
            expected: -Infinity,
        },
        {
            input: 'NaN',
            expected: NaN,
        },
        {
            input: '+NaN',
            expected: NaN,
        },
        {
            input: '-NaN',
            expected: NaN,
        },
        {
            input: '0x123',
            expected: 291,
        },
        {
            input: '+0x123',
            expected: 291,
        },
        {
            input: '-0x123',
            expected: -291,
        },
        {
            input: '.123',
            expected: 0.123,
        },
        {
            input: '+.123',
            expected: 0.123,
        },
        {
            input: '-.123',
            expected: -0.123,
        },
        {
            input: '123.',
            expected: 123,
        },
        {
            input: '+123.',
            expected: 123,
        },
        {
            input: '-123.',
            expected: -123,
        },
        {
            input: '123e4',
            expected: 123e4,
        },
        {
            input: '+123e4',
            expected: 123e4,
        },
        {
            input: '-123e4',
            expected: -123e4,
        },
        {
            input: '123e+4',
            expected: 123e4,
        },
        {
            input: '-123e+4',
            expected: -123e4,
        },
        {
            input: '123e-4',
            expected: 123e-4,
        },
        {
            input: '-123e-4',
            expected: -123e-4,
        },
        {
            input: '.123e4',
            expected: 0.123e4,
        },
        {
            input: '+.123e4',
            expected: 0.123e4,
        },
        {
            input: '-.123e4',
            expected: -0.123e4,
        },
        {
            input: '.123e+4',
            expected: 0.123e4,
        },
        {
            input: '-.123e+4',
            expected: -0.123e4,
        },
        {
            input: '.123e-4',
            expected: 0.123e-4,
        },
        {
            input: '-.123e-4',
            expected: -0.123e-4,
        },
        {
            input: '123.e4',
            expected: 123e4,
        },
        {
            input: '+123.e4',
            expected: 123e4,
        },
        {
            input: '-123.e4',
            expected: -123e4,
        },
        {
            input: '123.e+4',
            expected: 123e4,
        },
        {
            input: '-123.e+4',
            expected: -123e4,
        },
        {
            input: '123.e-4',
            expected: 123e-4,
        },
        {
            input: '-123.e-4',
            expected: -123e-4,
        },
        {
            // language=JSON5
            input: multiline`
            {
              foo: "bar",
              "baz": 1,
              'qux': true,
            }`,
            expected: {
                foo: 'bar',
                baz: 1,
                qux: true,
            },
        },
        {
            // language=JSON5
            input: multiline`
            'first line, \\
            second line, \\
            third line'`,
            expected: 'first line, second line, third line',
        },
        {
            // language=JSON5
            input: multiline`
            '\\'first line\\', \\
            \\'second line\\', \\
            \\'third line\\''`,
            expected: "'first line', 'second line', 'third line'",
        },
        {
            // language=JSON5
            input: multiline`
            "first line, \\
            second line, \\
            third line"`,
            expected: 'first line, second line, third line',
        },
        {
            // language=JSON5
            input: multiline`
            "\\"first line\\", \\
            \\"second line\\", \\
            \\"third line\\""`,
            expected: '"first line", "second line", "third line"',
        },
        {
            // language=JSON5
            input: multiline`
            // First line
            [
              // Second line
              1,
              // Third line
              2,
            ]`,
            expected: [1, 2],
        },
        {
            input: "'\uD83C\uDFBC'",
            expected: '🎼',
        },
    ])('should parse $input', ({input, expected}) => {
        const parser = new JsonParser(input);
        const node = parser.parseValue();

        expect(node.toJSON()).toEqual(expected);
        expect(node.toString()).toBe(input);
    });

    it.each(derive([
        1,
        null,
        true,
        false,
        '"string"',
        {},
        {number: 1},
        {null: null},
        {boolean: true},
        {string: 'string'},
        {array: [1, 2, 3]},
        {
            object: {
                key: 'value',
            },
        },
        {
            nested: {
                array: [1, 2, 3],
                object: {
                    key: 'value',
                },
            },
        },
        {
            number: 1,
            null: null,
            boolean: true,
            string: 'string',
            array: [
                {
                    number: 1,
                    null: null,
                    boolean: true,
                    string: 'string',
                    array: [1, 2, 3],
                    object: {
                        key: 'value',
                    },
                },
            ],
            object: {
                number: 1,
                null: null,
                boolean: true,
                string: 'string',
                array: [1, 2, 3],
                object: {
                    key: 'value',
                },
            },
        },
        [1, null, true, 'string', [1, 2, 3], {key: 'value'}],
        [],
    ]))('should losslessly parse %s', input => {
        const parser = new JsonParser(input);
        const node = parser.parseValue();

        expect(node.toString()).toBe(input);

        node.reformat();

        expect(node.toString()).toBe(JSON.stringify(JSON.parse(input)));
    });

    type ManipulationScenario<T extends JsonValueNode = JsonValueNode> = {
        description: string,
        input: string,
        output: string,
        type: new (definition: any) => T,
        mutation: (node: T) => void,
        format?: Formatting,
    };

    it.each<ManipulationScenario>([
        {
            description: 'use tab only if the input is indented with tabs',
            // language=JSON
            input: multiline`
            {
              \t\r"foo": 1
            }`,
            // language=JSON
            output: multiline`
            {
              \t\r"foo": 1,
            \t"bar": 2
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
        },
        {
            description: 'use tabs for indentation if detected',
            // language=JSON
            input: multiline`
            {
            \t"foo": 1
            }`,
            // language=JSON
            output: multiline`
            {
            \t"foo": 1,
            \t"bar": 2
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
        },
        {
            description: 'use the same indentation character as the the parent',
            // language=JSON
            input: multiline`
            {
            \t"foo": []
            }`,
            // language=JSON
            output: multiline`
            {
            \t"foo": [
            \t\t1
            \t]
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.get('foo', JsonArrayNode).push(1);
            },
        },
        {
            description: 'use the same character for indentation as the last property',
            // language=JSON
            input: multiline`
            {
              "foo": 1,
            \t"bar": 2
            }`,
            // language=JSON
            output: multiline`
            {
              "foo": 1,
            \t"bar": 2,
            \t"baz": 3
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('baz', 3);
            },
        },
        {
            description: 'use the same character for indentation as the las element',
            // language=JSON
            input: multiline`
            [
             1,
            \t2
            ]`,
            // language=JSON
            output: multiline`
            [
             1,
            \t2,
            \t3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(3);
            },
        },
        {
            description: 'add a property to an empty object with no indentation or spacing',
            // language=JSON
            input: '{}',
            // language=JSON
            output: '{"foo":1}',
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
        },
        {
            description: 'add an element to an empty array with no indentation or spacing',
            // language=JSON
            input: '[]',
            // language=JSON
            output: '[1,2]',
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1, 2);
            },
        },
        {
            description: 'add a property to an empty object with spacing but no indentation',
            // language=JSON
            input: '{}',
            // language=JSON
            output: '{"foo": 1}',
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                array: {
                    commaSpacing: true,
                    colonSpacing: true,
                },
            },
        },
        {
            description: 'add an element to an empty array with spacing but no indentation',
            // language=JSON
            input: '[]',
            // language=JSON
            output: '[1, 2]',
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1, 2);
            },
            format: {
                array: {
                    commaSpacing: true,
                },
            },
        },
        {
            description: 'add a property to an empty object with indentation but no spacing',
            // language=JSON
            input: '{}',
            // language=JSON
            output: multiline`
            {
              "foo":1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                object: {
                    indentationSize: 2,
                    leadingIndentation: true,
                    trailingIndentation: true,
                },
            },
        },
        {
            description: 'add an element to an empty array with indentation but no spacing',
            // language=JSON
            input: '[]',
            // language=JSON
            output: multiline`
            [
              1,
              2
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1, 2);
            },
            format: {
                array: {
                    indentationSize: 2,
                    entryIndentation: true,
                    trailingIndentation: true,
                    leadingIndentation: true,
                },
            },
        },
        {
            description: 'add a property to an empty object with indentation and spacing',
            // language=JSON
            input: '{}',
            // language=JSON
            output: multiline`
            {
              "foo": 1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                object: {
                    indentationSize: 2,
                    colonSpacing: true,
                    leadingIndentation: true,
                    trailingIndentation: true,
                },
            },
        },
        {
            description: 'add an element to an empty array with indentation and spacing',
            // language=JSON
            input: '[]',
            // language=JSON
            output: multiline`
            [
              1,
              {
                "foo": 2
              }
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1, {foo: 2});
            },
            format: {
                object: {
                    indentationSize: 2,
                    entryIndentation: true,
                    leadingIndentation: true,
                    trailingIndentation: true,
                },
                array: {
                    indentationSize: 2,
                    colonSpacing: true,
                    entryIndentation: true,
                },
            },
        },
        {
            description: 'add a property to an empty object leading, trailing, and no item indentation or spacing',
            // language=JSON
            input: '{}',
            // language=JSON
            output: multiline`
              {
                "foo":1,"bar":2,"baz":3
              }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
                node.set('bar', 2);
                node.set('baz', 3);
            },
            format: {
                object: {
                    indentationSize: 2,
                    commaSpacing: false,
                    colonSpacing: false,
                    entryIndentation: false,
                    trailingIndentation: true,
                    leadingIndentation: true,
                },
            },
        },
        {
            description: 'add an element to an empty array leading, trailing, and no item indentation or spacing',
            // language=JSON
            input: '[]',
            // language=JSON
            output: multiline`
              [
                1,2,3
              ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1, 2, 3);
            },
            format: {
                array: {
                    indentationSize: 2,
                    commaSpacing: false,
                    entryIndentation: false,
                    trailingIndentation: true,
                    leadingIndentation: true,
                },
            },
        },
        {
            description: 'add a property to an empty object leading, trailing, and no item indentation',
            // language=JSON
            input: '{}',
            // language=JSON
            output: multiline`
            {
              "foo": 1, "bar": 2, "baz": 3
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
                node.set('bar', 2);
                node.set('baz', 3);
            },
            format: {
                object: {
                    indentationSize: 2,
                    commaSpacing: true,
                    colonSpacing: true,
                    entryIndentation: false,
                    trailingIndentation: true,
                    leadingIndentation: true,
                },
            },
        },
        {
            description: 'add an element to an empty array leading, trailing, and no item indentation',
            // language=JSON
            input: '[]',
            // language=JSON
            output: multiline`
            [
              1, 2, 3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1, 2, 3);
            },
            format: {
                array: {
                    indentationSize: 2,
                    commaSpacing: true,
                    entryIndentation: false,
                    trailingIndentation: true,
                    leadingIndentation: true,
                },
            },
        },
        {
            description: 'set a nested property with the same indentation and spacing as the parent',
            // language=JSON
            input: multiline`
            {
              "foo": {}
            }`,
            // language=JSON
            output: multiline`
            {
              "foo": {
                "bar": 1,
                "baz": {
                  "qux": 2
                }
              }
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const foo = node.get('foo', JsonObjectNode);

                foo.set('bar', 1);
                foo.set('baz', {qux: 2});
            },
        },
        {
            description: 'add a nested element with the same indentation and spacing as the parent',
            // language=JSON
            input: multiline`
            [
              []
            ]`,
            // language=JSON
            output: multiline`
            [
              [
                1,
                {
                  "foo": 2
                }
              ]
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                const array = node.get(0, JsonArrayNode);

                array.push(1, {foo: 2});
            },
        },
        {
            description: 'should replace a property preserving the formatting of the following properties',
            // language=JSON
            input: multiline`
            {
              "foo": 1,
               "bar":2,
                "baz": 3
            }`,
            // language=JSON
            output: multiline`
            {
              "foo": null,
               "bar":2,
                "baz": 3
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', null);
            },
        },
        {
            description: 'should replace an element preserving the formatting of the following elements',
            // language=JSON
            input: multiline`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: multiline`
            [
             null,
              2,
               3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.set(0, null);
            },
        },
        {
            description: 'delete a property preserving the formatting of the following properties',
            // language=JSON
            input: multiline`
            {
              "foo": 1,
               "bar":2,
                "baz": 3
            }`,
            // language=JSON
            output: multiline`
            {
               "bar":2,
                "baz": 3
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.delete('foo');
            },
        },
        {
            description: 'delete an element preserving the formatting of the following elements',
            // language=JSON
            input: multiline`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: multiline`
            [
              2,
               3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.delete(0);
            },
        },
        {
            description: 'insert an element preserving the formatting of the following elements',
            // language=JSON
            input: multiline`
            [
             1,
              3
            ]`,
            // language=JSON
            output: multiline`
            [
             1,
              2,
              3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.splice(1, 0, 2);
            },
        },
        {
            description: 'replace multiple properties preserving the formatting of the following properties',
            // language=JSON
            input: multiline`
            {
              "foo": 1,
               "bar":2,
                "baz": 3
            }`,
            // language=JSON
            output: multiline`
            {
              "foo": null,
               "bar":null,
                "baz": null
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', null);
                node.set('bar', null);
                node.set('baz', null);
            },
        },
        {
            description: 'replace multiple elements preserving the formatting of the following elements',
            // language=JSON
            input: multiline`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: multiline`
            [
             null,
              null,
               null
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.set(0, null);
                node.set(1, null);
                node.set(2, null);
            },
        },
        {
            description: 'delete multiple leading properties preserving the formatting of the following properties',
            // language=JSON
            input: multiline`
            {
              "foo": 1,
               "bar":2,
                "baz": 3
            }`,
            // language=JSON
            output: multiline`
            {
                "baz": 3
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.delete('foo');
                node.delete('bar');
            },
        },
        {
            description: 'delete multiple leading elements preserving the formatting of the following elements',
            // language=JSON
            input: multiline`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: multiline`
            [
               3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.splice(0, 2);
            },
        },
        {
            description: 'delete multiple trailing properties preserving the formatting of the preceding properties',
            // language=JSON
            input: multiline`
            {
              "foo": 1,
               "bar":2,
                "baz": 3
            }`,
            // language=JSON
            output: multiline`
            {
              "foo": 1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.delete('bar');
                node.delete('baz');
            },
        },
        {
            description: 'delete multiple trailing elements preserving the formatting of the preceding elements',
            // language=JSON
            input: multiline`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: multiline`
            [
             1
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.splice(1, 2);
            },
        },
        {
            description: 'delete multiple properties preserving the formatting of the surrounding properties',
            // language=JSON
            input: multiline`
            {
              "foo": 1,
                 "bar":2,
               "baz": 3,
                 "qux": 4,
              "quux": 5
            }`,
            // language=JSON
            output: multiline`
            {
                 "bar":2,
              "quux": 5
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.delete('foo');
                node.delete('baz');
                node.delete('qux');
            },
        },
        {
            description: 'delete multiple elements preserving the formatting of the surrounding elements',
            // language=JSON
            input: multiline`
            [
              1,
                 2,
               3,
                 4,
              5
            ]`,
            // language=JSON
            output: multiline`
            [
                 2,
              5
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.delete(0);
                node.delete(1);
                node.delete(1);
            },
        },
        {
            description: 'keep the same indentation as the last property when adding a new property',
            // language=JSON
            input: multiline`
            {
             "foo": 1,
              "bar": 2,
               "baz": 3
            }`,
            // language=JSON
            output: multiline`
            {
             "foo": 1,
              "bar": 2,
               "baz": 3,
               "qux": 4
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('qux', 4);
            },
        },
        {
            description: 'keep the same indentation as the last element when adding a new element',
            // language=JSON
            input: multiline`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: multiline`
            [
             1,
              2,
               3,
               4
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(4);
            },
        },
        {
            description: 'preserve the leading and trailing indentation when adding a new property',
            // language=JSON
            input: multiline`
            {"foo": 1,
             "bar": 2}`,
            // language=JSON
            output: multiline`
            {"foo": 1,
             "bar": 2,
             "baz": 3}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('baz', 3);
            },
        },
        {
            description: 'preserve the leading and trailing indentation when adding a new element',
            // language=JSON
            input: multiline`
            [1,
             2]`,
            // language=JSON
            output: multiline`
            [1,
             2,
             3]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(3);
            },
        },
        {
            description: 'add a property to an empty object with leading but no trailing indentation',
            // language=JSON
            input: '{}',
            // language=JSON
            output: multiline`
            {
              "foo":1}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                object: {
                    indentationSize: 2,
                    leadingIndentation: true,
                    trailingIndentation: false,
                },
            },
        },
        {
            description: 'add an element to an empty array with leading but no trailing indentation',
            // language=JSON
            input: '[]',
            // language=JSON
            output: multiline`
            [
              1]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
            format: {
                array: {
                    indentationSize: 2,
                    leadingIndentation: true,
                    trailingIndentation: false,
                },
            },
        },
        {
            description: 'add a property to an empty object with no leading but trailing indentation',
            // language=JSON
            input: '{}',
            // language=JSON
            output: multiline`
            {"foo":1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                object: {
                    indentationSize: 2,
                    leadingIndentation: false,
                    trailingIndentation: true,
                },
            },
        },
        {
            description: 'add an element to an empty array with no leading but trailing indentation',
            // language=JSON
            input: '[]',
            // language=JSON
            output: multiline`
            [1
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
            format: {
                array: {
                    indentationSize: 2,
                    leadingIndentation: false,
                    trailingIndentation: true,
                },
            },
        },
        {
            description: 'preserve the innermost leading and trailing indentation when adding a new property',
            // language=JSON
            input: multiline`
            {
              "foo": {"bar": 1}
            }`,
            // language=JSON
            output: multiline`
            {
              "foo": {"bar": 1, "baz": 2}
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.get('foo', JsonObjectNode).set('baz', 2);
            },
        },
        {
            description: 'preserve the innermost leading and trailing indentation when adding a new element',
            // language=JSON
            input: multiline`
            [
              [1]
            ]`,
            // language=JSON
            output: multiline`
            [
              [1, 2]
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.get(0, JsonArrayNode).push(2);
            },
        },
        {
            description: 'preserve mixed formatting when adding a new property',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4
              ]}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4
              ],
              "qux": 5}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('qux', 5);
            },
        },
        {
            description: 'preserve mixed formatting when adding a new element',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4
                ]}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4, 5
                ]}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonArrayNode);

                baz.push(5);
            },
        },
        {
            description: 'preserve mixed formatting when deleting a property from the end of the line',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
              }}`,
            // language=JSON
            output: multiline`
            {"foo": 1,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
              }}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.delete('bar');
            },
        },
        {
            description: 'preserve mixed formatting when deleting an element from the end of the line',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4, 5
              ]}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4
              ]}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonArrayNode);

                baz.delete(2);
            },
        },
        {
            description: 'preserve mixed formatting when deleting a property from the middle',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
              }}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quuz": 5
              }}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonObjectNode);

                baz.delete('quux');
            },
        },
        {
            description: 'preserve mixed formatting when deleting an element from the middle',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4, 5
              ]}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 5
              ]}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonArrayNode);

                baz.delete(1);
            },
        },
        {
            description: 'preserve mixed formatting when deleting a property from the beginning',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
              }}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                "quux": 4, "quuz": 5
              }}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonObjectNode);

                baz.delete('qux');
            },
        },
        {
            description: 'preserve mixed formatting when deleting an element from the beginning',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4
                ]}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                4
                ]}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonArrayNode);

                baz.delete(0);
            },
        },
        {
            description: 'preserve mixed formatting when deleting a property from the end',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
              }}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4
              }}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonObjectNode);

                baz.delete('quuz');
            },
        },
        {
            description: 'preserve mixed formatting when deleting an element from the end',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4, 5
               ]}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4
              ]}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonArrayNode);

                baz.delete(2);
            },
        },
        {
            description: 'preserve mixed formatting when deleting the last property',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
                }}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.delete('baz');
            },
        },
        {
            description: 'preserve mixed formatting when deleting the last element',
            // language=JSON
            input: multiline`
            [1, 2,
              [3, 4, 5]]`,
            // language=JSON
            output: multiline`
            [1, 2]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.delete(2);
            },
        },
        {
            description: 'preserve mixed formatting when deleting all properties',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
                }}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                }}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonObjectNode);

                baz.delete('qux');
                baz.delete('quux');
                baz.delete('quuz');
            },
        },
        {
            description: 'preserve mixed formatting when deleting and adding properties',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
                }}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "qux": 3}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.delete('baz');
                node.set('qux', 3);
            },
        },
        {
            description: 'preserve mixed formatting when adding and deleting elements',
            // language=JSON
            input: multiline`
            [1, 2,
              [3, 4, 5]]`,
            // language=JSON
            output: multiline`
            [1, 2,
              3]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.delete(2);
                node.push(3);
            },
        },
        {
            description: 'preserve mixed formatting when deleting all elements',
            // language=JSON
            input: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4, 5
                ]}`,
            // language=JSON
            output: multiline`
            {"foo": 1, "bar":2,
              "baz": [
                ]}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonArrayNode);

                baz.clear();
            },
        },
        {
            description: 'preserve mixed spacing when adding a new property',
            // language=JSON
            input: multiline`
            {
              "foo":1, "bar":2
            }`,
            // language=JSON
            output: multiline`
            {
              "foo":1, "bar":2, "baz":3
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('baz', 3);
            },
        },
        {
            description: 'preserve mixed spacing when adding a new element',
            // language=JSON
            input: multiline`
            [
              {"foo":1}, {"bar":2}
            ]`,
            // language=JSON
            output: multiline`
            [
              {"foo":1}, {"bar":2}, {"baz":3}
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push({baz: 3});
            },
        },
        {
            description: 'preserve mixed formatting when adding a new property',
            // language=JSON
            input: multiline`
            {
              "foo":1, "bar":2,
              "baz": 3
            }`,
            // language=JSON
            output: multiline`
            {
              "foo":1, "bar":2,
              "baz": 3,
              "qux": 4
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('qux', 4);
            },
        },
        {
            description: 'preserve mixed formatting when adding a new element',
            // language=JSON
            input: multiline`
            [
              ["foo",1], ["bar",2],
              ["baz", 3]
            ]`,
            // language=JSON
            output: multiline`
            [
              ["foo",1], ["bar",2],
              ["baz", 3],
              ["qux", 4]
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(['qux', 4]);
            },
        },
        {
            description: 'preserve mixed formatting when adding a property to a nested object',
            // language=JSON
            input: multiline`
            {"a": 1, "b": 2,
              "c": {"d": 3}}`,
            // language=JSON
            output: multiline`
            {"a": 1, "b": 2,
              "c": {"d": 3, "e": 4}}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const c = node.get('c', JsonObjectNode);

                c.set('e', 4);
            },
        },
        {
            description: 'preserve the spacing when adding an element to a nested array',
            // language=JSON
            input: multiline`
            ["a", "b",
              ["c"]]`,
            // language=JSON
            output: multiline`
            ["a", "b",
              ["c", "d"]]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                const array = node.get(2, JsonArrayNode);

                array.push('d');
            },
        },
        {
            description: 'preserve mixed formatting when adding properties to a nested empty object',
            // language=JSON
            input: multiline`
            {"a": 1, "b": 2,
              "c": {}}`,
            // language=JSON
            output: multiline`
            {"a": 1, "b": 2,
              "c": {"d": 3,
                "e": 4}}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const c = node.get('c', JsonObjectNode);

                c.set('d', 3);
                c.set('e', 4);
            },
        },
        {
            description: 'preserve mixed formatting when adding elements to a nested empty array',
            // language=JSON
            input: multiline`
            ["a", "b",
              []]`,
            // language=JSON
            output: multiline`
            ["a", "b",
              ["c",
                "d"]]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                const array = node.get(2, JsonArrayNode);

                array.push('c', 'd');
            },
        },
        {
            description: 'keep the formatting of the last property when adding a new property',
            // language=JSON
            input: multiline`
              {
                "foo": [
                  "a"
                ],
                "bar": {
                  "baz":"c", "qux":"d"
                }
              }`,
            // language=JSON
            output: multiline`
              {
                "foo": [
                  "a",
                  "b"
                ],
                "bar": {
                  "baz":"c", "qux":"d", "quux":"e"
                },
                "baz":{
                  "e":5, "f":6
                },
                "qux":[
                  3,
                  4
                ]
              }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.get('foo', JsonArrayNode).push('b');

                const bar = node.get('bar', JsonObjectNode);

                bar.set('qux', 'd');
                bar.set('quux', 'e');

                node.set('baz', {e: 5, f: 6});

                node.set('qux', [3, 4]);
            },
        },
        {
            description: 'keep the formatting of the last element when adding a new element',
            // language=JSON
            input: multiline`
            [
              [
                "a"
              ],
              ["c"]
            ]`,
            // language=JSON
            output: multiline`
            [
              [
                "a",
                "b"
              ],
              ["c", "d"],
              ["e"]
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.get(0, JsonArrayNode).push('b');
                node.get(1, JsonArrayNode).push('d');
                node.push(['e']);
            },
        },
        {
            description: 'use the formatting of the last array adding a new array',
            // language=JSON
            input: multiline`
            [
              [
                "a",
                "b"
              ],
              {"foo":"bar"}
            ]`,
            // language=JSON
            output: multiline`
            [
              [
                "a",
                "b"
              ],
              {"foo":"bar"},
              [
                "c",
                "d"
              ]
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(['c', 'd']);
            },
        },
        {
            description: 'preserve the formatting formatting differences between arrays and objects',
            // language=JSON
            input: multiline`
            [
              [
                "a",
                "b"
              ],
              {"foo":"bar"}
            ]`,
            // language=JSON
            output: multiline`
            [
              [
                "a",
                "b"
              ],
              {"foo":"bar"},
              [
                "c",
                "d"
              ],
              {"baz":"qux"}
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(['c', 'd']);
                node.push({baz: 'qux'});
            },
        },
        {
            description: 'preserve wrong indentation when adding a new property',
            // language=JSON
            input: multiline`
            {
              "foo": 1
               }`,
            // language=JSON
            output: multiline`
            {
              "foo": 1,
              "bar": 2
               }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
        },
        {
            description: 'preserve absence of formatting when adding a new property',
            // language=JSON
            input: multiline`
            {"foo":1}`,
            // language=JSON
            output: multiline`
            {"foo":1,"bar":{"baz":2},"qux":[3,4]}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', {baz: 2});
                node.set('qux', [3, 4]);
            },
        },
        {
            description: 'preserve absence of formatting when adding a new element',
            // language=JSON
            input: multiline`
            [1]`,
            // language=JSON
            output: multiline`
            [1,[{"foo":2}],[3,4]]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push([{foo: 2}], [3, 4]);
            },
        },
        {
            description: 'preserve leading and trailing spaces',
            // language=JSON
            input: '    {"foo": 1}     ',
            // language=JSON
            output: '    {"foo": 1}     ',
            type: JsonObjectNode,
            mutation: (): void => {
                // Do nothing
            },
        },
        {
            description: 'preserve empty object formatting',
            // language=JSON
            input: multiline`
            {
              "bar": [],
              "foo": {
                
              } 
            }`,
            // language=JSON
            output: multiline`
            {
              "bar": [],
              "foo": {
                
              } 
            }`,
            type: JsonObjectNode,
            mutation: (): void => {
                // Do nothing
            },
        },
        {
            description: 'preserve empty array formatting',
            // language=JSON
            input: multiline`
            {
              "bar": {},
              "foo": [
                  
              ] 
            }`,
            // language=JSON
            output: multiline`
            {
              "bar": {},
              "foo": [
                  
              ] 
            }`,
            type: JsonObjectNode,
            mutation: (): void => {
                // Do nothing
            },
        },
        {
            description: 'use add a property to an empty object preserving the leading and trailing spaces',
            // language=JSON
            input: multiline`
            {
            
            }`,
            // language=JSON
            output: multiline`
            {
            "foo": 1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
        },
        {
            description: 'add an element to an empty array preserving the leading and trailing spaces',
            // language=JSON
            input: multiline`
            [
            
            ]`,
            // language=JSON
            output: multiline`
            [
            1
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
        },
        {
            description: 'preserve the indentation of an empty object when adding a property',
            // language=JSON
            input: multiline`
            {
              "foo": 1,
              "bar": {
              
              }
            }`,
            // language=JSON
            output: multiline`
            {
              "foo": 1,
              "bar": {
                "baz": 2
              }
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.get('bar', JsonObjectNode).set('baz', 2);
            },
        },
        {
            description: 'preserve the indentation of an empty array when adding an element',
            // language=JSON
            input: multiline`
            [
              1,
              [
              
              ]
            ]`,
            // language=JSON
            output: multiline`
            [
              1,
              [
                2
              ]
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.get(1, JsonArrayNode).push(2);
            },
        },
        {
            description: 'add a property to an empty object using the specified indentation',
            // language=JSON
            input: multiline`
            {
            
            }`,
            // language=JSON
            output: multiline`
            {
              "foo": 1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                object: {
                    indentationSize: 2,
                },
            },
        },
        {
            description: 'add a property to an empty array using the specified indentation',
            // language=JSON
            input: multiline`
            [
            
            ]`,
            // language=JSON
            output: multiline`
            [
              1
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
            format: {
                object: {
                    indentationSize: 2,
                },
            },
        },
        {
            description: 'preserve trailing blank lines when adding a property to an empty object',
            // language=JSON
            input: multiline`
            {
            
            
            }`,
            // language=JSON
            output: multiline`
            {
            "foo": 1

            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
        },
        {
            description: 'preserve trailing blank lines when adding an element to an empty array',
            // language=JSON
            input: multiline`
            [
            
            
            ]`,
            // language=JSON
            output: multiline`
            [
            1

            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
        },
        {
            description: 'preserve multiple lines with partial indentation adding a property to an empty object',
            // language=JSON
            input: multiline`
            {
              
            
            }`,
            // language=JSON
            output: multiline`
            {
              "foo": 1
            
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
        },
        {
            description: 'preserve multiple lines with partial indentation adding a property to an empty array',
            // language=JSON
            input: multiline`
            [
              
            
            ]`,
            // language=JSON
            output: multiline`
            [
              1
            
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
        },
        {
            description: 'preserve last line of empty object with full indentation when adding a property',
            // language=JSON
            input: multiline`
            {
              
              
            }`,
            // language=JSON
            output: multiline`
            {
              "foo": 1
              
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
        },
        {
            description: 'preserve last line of empty array with full indentation when adding an element',
            // language=JSON
            input: multiline`
            [
              
              
            ]`,
            // language=JSON
            output: multiline`
            [
              1
              
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
        },
        {
            description: 'preserve empty lines',
            // language=JSON
            input: multiline`
            {
              "compilerOptions": {
                "skipLibCheck": true,
            
                "moduleResolution": "bundler",
            
                "strict": true
              },
              "include": ["src"]
            }`,
            // language=JSON
            output: multiline`
            {
              "compilerOptions": {
                "skipLibCheck": true,
            
                "moduleResolution": "bundler",
            
                "strict": true
              },
              "include": ["src"]
            }`,
            type: JsonObjectNode,
            mutation: (): void => {
            },
        },
        {
            description: 'preserve identifiers',
            // language=JSON5
            input: multiline`
            {
              foo: 1
            }`,
            // language=JSON5
            output: multiline`
            {
              foo: 1,
              bar: 2
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set(JsonIdentifierNode.of('bar'), 2);
            },
        },
        {
            description: 'add trailing comma to the last property if currently present',
            // language=JSON5
            input: multiline`
            {
              "foo": 1,
            }`,
            // language=JSON5
            output: multiline`
            {
              "foo": 1,
              "bar": 2,
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
        },
        {
            description: 'add trailing comma to the last element if currently present',
            // language=JSON5
            input: multiline`
            [
              1,
            ]`,
            // language=JSON5
            output: multiline`
            [
              1,
              2,
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(2);
            },
        },
        {
            description: 'not add trailing comma to the last property if not currently present',
            // language=JSON5
            input: multiline`
            {
              "foo": 1
            }`,
            // language=JSON5
            output: multiline`
            {
              "foo": 1,
              "bar": 2
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
        },
        {
            description: 'not add trailing comma to the last element if not currently present',
            // language=JSON5
            input: multiline`
            [
              1
            ]`,
            // language=JSON5
            output: multiline`
            [
              1,
              2
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(2);
            },
        },
        {
            description: 'add trailing comma to the last property if specified',
            // language=JSON5
            input: multiline`
            {
              
            }`,
            // language=JSON5
            output: multiline`
            {
              "bar": 1,
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 1);
            },
            format: {
                object: {
                    trailingComma: true,
                },
            },
        },
        {
            description: 'add trailing comma to the last element if specified',
            // language=JSON5
            input: multiline`
            [
              
            ]`,
            // language=JSON5
            output: multiline`
            [
              1,
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
            format: {
                array: {
                    trailingComma: true,
                },
            },
        },
        {
            description: 'preserve hexadecimal number representation',
            // language=JSON5
            input: multiline`
            {
              foo: 0x1
            }`,
            // language=JSON5
            output: multiline`
            {
              foo: 0x1
            }`,
            type: JsonObjectNode,
            mutation: (): void => {
            },
        },
        {
            description: 'preserve infinity',
            // language=JSON5
            input: multiline`
            {
              foo: Infinity
            }`,
            // language=JSON5
            output: multiline`
            {
              foo: Infinity
            }`,
            type: JsonObjectNode,
            mutation: (): void => {
            },
        },
        {
            description: 'preserve not-a-number',
            // language=JSON5
            input: multiline`
            {
              foo: NaN
            }`,
            // language=JSON5
            output: multiline`
            {
              foo: NaN
            }`,
            type: JsonObjectNode,
            mutation: (): void => {
            },
        },
        {
            description: 'preserve leading line comments',
            // language=JSON5
            input: multiline`
            // Comment
            {
              "foo": 1
            }`,
            // language=JSON5
            output: multiline`
            // Comment
            {
              "foo": 1,
              "bar": 2
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
        },
        {
            description: 'preserve leading line comments',
            // language=JSON5
            input: multiline`
            /* 
             * Comment
             */
            {
              "foo": 1
            }`,
            // language=JSON5
            output: multiline`
            /* 
             * Comment
             */
            {
              "foo": 1,
              "bar": 2
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
        },
        {
            description: 'preserve trailing line comments',
            // language=JSON5
            input: multiline`
            {
              "foo": 1
            }
            // Comment`,
            // language=JSON5
            output: multiline`
            {
              "foo": 1,
              "bar": 2
            }
            // Comment`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
        },
        {
            description: 'preserve line comments after opening brace',
            // language=JSON5
            input: multiline`
            {
              // Comment
            }`,
            // language=JSON5
            output: multiline`
            {
              // Comment
              "foo": 1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
        },
        {
            description: 'preserve line comments before closing brace',
            // language=JSON5
            input: multiline`
            {
              "foo": 1
              // Comment
            }`,
            // language=JSON5
            output: multiline`
            {
              "foo": 1,
              // Comment
              "bar": 2
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
        },
        {
            description: 'preserve comments removing properties',
            // language=JSON5
            input: multiline`
            {
              // Top
              foo: 1, // Right
              // Bottom
            }`,
            // language=JSON5
            output: multiline`
            {
              // Top
              // Right
              // Bottom
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.delete('foo');
            },
        },
        {
            description: 'preserve comments around spaces',
            // language=JSON5
            input: multiline`
            {
              // Top
              
              // Right
              
              // Bottom
            }`,
            // language=JSON5
            output: multiline`
            {
              // Top
              
              // Right
              
              // Bottom
              "foo": 1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
        },
        {
            description: 'preserve comments adding elements',
            // language=JSON5
            input: multiline`
            [
              // Top
              
              // Right
              
              // Bottom
            ]`,
            // language=JSON5
            output: multiline`
            [
              // Top
              
              // Right
              
              // Bottom
              1
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
        },
        {
            description: 'preserve comments removing elements',
            // language=JSON5
            input: multiline`
            [
              // Top
              1, // Right
              // Bottom
              2
              // End
            ]`,
            // language=JSON5
            output: multiline`
            [
              // Top
              // Right
              // Bottom
              // End
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.delete(0);
                node.delete(0);
            },
        },
        {
            description: 'preserve comments removing and adding elements',
            // language=JSON5
            input: multiline`
            [
              // Top
              1, // Right
              // Bottom
              2
              // End
            ]`,
            // language=JSON5
            output: multiline`
            [
              // Top
              // Right
              // Bottom
              2,
              // End
              3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.delete(0);
                node.push(3);
            },
        },
        {
            description: 'break the line adding a property after a line comment',
            // language=JSON5
            input: multiline`
            {"foo": 1, "bar": 2 // comment
            }`,
            // language=JSON5
            output: multiline`
            {"foo": 1, "bar": 2, // comment
            "qux": 3
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('qux', 3);
            },
        },
        {
            description: 'not break the line adding a property after a block comment',
            // language=JSON5
            input: multiline`
            {"foo": 1, "bar": 2 /* comment */
            }`,
            // language=JSON5
            output: multiline`
            {"foo": 1, "bar": 2, /* comment */ "qux": 3
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('qux', 3);
            },
        },
        {
            description: 'add a space after block comment adding a property if the comment has a trailing space',
            // language=JSON5
            input: multiline`
            {"foo": 1,"bar": 2 /* comment */
            }`,
            // language=JSON5
            output: multiline`
            {"foo": 1,"bar": 2, /* comment */ "qux": 3
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('qux', 3);
            },
        },
        {
            description: 'not add a space after block comment adding a property if the comment has no trailing space',
            // language=JSON5
            input: multiline`
            {"foo": 1,"bar": "foo"/* comment*/
            }`,
            // language=JSON5
            output: multiline`
            {"foo": 1,"bar": "foo",/* comment*/"qux": 3
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('qux', 3);
            },
        },
        {
            description: 'break the line adding an element after a line comment',
            // language=JSON5
            input: multiline`
            [1, 2 // comment
            ]`,
            // language=JSON5
            output: multiline`
            [1, 2, // comment
            3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(3);
            },
        },
        {
            description: 'not break the line adding an element after a block comment',
            // language=JSON5
            input: multiline`
            [1, 2 /* comment */
            ]`,
            // language=JSON5
            output: multiline`
            [1, 2, /* comment */ 3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(3);
            },
        },
        {
            description: 'add a space after block comment adding an element the comment has a trailing space',
            // language=JSON5
            input: multiline`
            [1,2 /* comment */
            ]`,
            // language=JSON5
            output: multiline`
            [1,2, /* comment */ 3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(3);
            },
        },
        {
            description: 'not add a space after block comment adding an element if the comment has no trailing space',
            // language=JSON5
            input: multiline`
            [1,"foo"/* comment*/
            ]`,
            // language=JSON5
            output: multiline`
            [1,"foo",/* comment*/3
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(3);
            },
        },
        {
            description: 'use double quotes for property names',
            // language=JSON5
            input: multiline`
            {
              foo: 1,
            }`,
            // language=JSON5
            output: multiline`
            {
              foo: 1,
              "'\\"bar\\"'": 2,
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('\'"bar"\'', 2);
            },
            format: {
                property: {
                    quote: 'double',
                },
            },
        },
        {
            description: 'use single quotes for property names',
            // language=JSON5
            input: multiline`
            {
              
            }`,
            // language=JSON5
            output: multiline`
            {
              '"\\'bar\\'"': 2
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('"\'bar\'"', 2);
            },
            format: {
                property: {
                    quote: 'single',
                },
            },
        },
        {
            description: 'use identifiers for valid keywords',
            // language=JSON5
            input: multiline`
            {
              foo: 1,
            }`,
            // language=JSON5
            output: multiline`
            {
              foo: 1,
              bar: 2,
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
            format: {
                property: {
                    unquoted: true,
                },
            },
        },
        {
            description: 'use single-quoted strings for invalid keywords',
            // language=JSON5
            input: multiline`
            {
              
            }`,
            // language=JSON5
            output: multiline`
            {
              'if': 2
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('if', 2);
            },
            format: {
                property: {
                    quote: 'single',
                    unquoted: true,
                },
            },
        },
        {
            description: 'use double-quoted strings for invalid keywords',
            // language=JSON5
            input: multiline`
            {
              foo: 1,
            }`,
            // language=JSON5
            output: multiline`
            {
              foo: 1,
              "if": 2,
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('if', 2);
            },
        },
        {
            description: 'use single quotes for strings',
            // language=JSON5
            input: multiline`
            {
              
            }`,
            // language=JSON5
            output: multiline`
            {
              'bar': 'qux'
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 'qux');
            },
            format: {
                string: {
                    quote: 'single',
                },
            },
        },
        {
            description: 'use double quotes for strings',
            // language=JSON5
            input: multiline`
            {
              
            }`,
            // language=JSON5
            output: multiline`
            {
              "bar": "qux"
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 'qux');
            },
            format: {
                string: {
                    quote: 'double',
                },
            },
        },
        {
            description: 'use single quotes for property names and double quotes for strings',
            // language=JSON5
            input: multiline`
            {
              
            }`,
            // language=JSON5
            output: multiline`
            {
              'bar': "qux"
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 'qux');
            },
            format: {
                property: {
                    quote: 'single',
                },
                string: {
                    quote: 'double',
                },
            },
        },
        {
            description: 'use double quotes for property names and single quotes for strings',
            // language=JSON5
            input: multiline`
            {
              
            }`,
            // language=JSON5
            output: multiline`
            {
              "bar": 'qux'
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 'qux');
            },
            format: {
                property: {
                    quote: 'double',
                },
                string: {
                    quote: 'single',
                },
            },
        },
        {
            description: 'use single quotes for property names if other properties use single quotes',
            // language=JSON5
            input: multiline`
            {
              'foo': 'baz'
            }`,
            // language=JSON5
            output: multiline`
            {
              'foo': 'baz',
              'bar': 'qux'
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 'qux');
            },
        },
        {
            description: 'use double quotes for property names if other properties use double quotes',
            // language=JSON5
            input: multiline`
            {
              "foo": "baz"
            }`,
            // language=JSON5
            output: multiline`
            {
              "foo": "baz",
              "bar": "qux"
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 'qux');
            },
        },
        {
            description: 'use unquoted property names if other properties use unquoted names',
            // language=JSON5
            input: multiline`
            {
              foo: 1
            }`,
            // language=JSON5
            output: multiline`
            {
              foo: 1,
              bar: 2
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 2);
            },
        },
        {
            description: 'use double-quoted strings if other strings use double quotes',
            // language=JSON5
            input: multiline`
              {
                'foo': "baz"
              }`,
            // language=JSON5
            output: multiline`
              {
                'foo': "baz",
                'bar': "qux"
              }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 'qux');
            },
        },
        {
            description: 'use single-quoted strings if other strings use single quotes',
            // language=JSON5
            input: multiline`
            {
              "foo": 'baz'
            }`,
            // language=JSON5
            output: multiline`
            {
              "foo": 'baz',
              "bar": 'qux'
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('bar', 'qux');
            },
        },
    ])('should $description', ({input, output, type, mutation, format}) => {
        const node = JsonParser.parse(input, type);

        mutation(node);

        expect(node.toString(format)).toBe(output);
    });

    function derive(scenarios: JsonValue[]): string[] {
        return scenarios.flatMap(
            value => (
                typeof value === 'string'
                    ? [value]
                    : [
                        JSON.stringify(value),
                        JSON.stringify(value, null, 2),
                    ]
            ),
        );
    }

    function multiline(strings: TemplateStringsArray): string {
        const lines = strings.join('').split('\n');

        if (lines.length < 2) {
            return strings.join('');
        }

        const indent = lines[1].search(/\S/);

        return lines
            .map(line => line.slice(indent))
            .join('\n')
            .trim();
    }
});
