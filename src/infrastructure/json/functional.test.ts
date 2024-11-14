import {JsonValue} from '@croct/json';
import {JsonParser} from './parser';
import {Formatting, JsonArrayNode, JsonObjectNode, JsonValueNode} from './node';

describe('Functional test', () => {
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
                bracket: {
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
                bracket: {
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
                brace: {
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
                bracket: {
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
                brace: {
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
                brace: {
                    indentationSize: 2,
                    entryIndentation: true,
                    leadingIndentation: true,
                    trailingIndentation: true,
                },
                bracket: {
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
                brace: {
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
                bracket: {
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
                brace: {
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
                bracket: {
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
                brace: {
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
                bracket: {
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
                brace: {
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
                bracket: {
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
              "baz": {}}`,
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
              "baz": []}`,
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
    ])('should $description', ({input, output, type, mutation, format}) => {
        const node = JsonParser.parse(input, type);

        mutation(node);

        expect(node.toString(format)).toBe(output);
    });

    function derive(scenarios: JsonValue[]): string[] {
        return scenarios.flatMap(
            value => [
                JSON.stringify(value),
                JSON.stringify(value, null, 2),
            ],
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
