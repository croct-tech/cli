import {JsonValue} from '@croct/json';
import {JsonParser} from '@/infrastructure/json/parser';
import {JsonArrayNode, JsonObjectNode, JsonValueNode} from '@/infrastructure/json/node';
import {Formatting} from '@/infrastructure/json/node/treeNode';

describe('Functional test', () => {
    function derive(scenarios: JsonValue[]): string[] {
        return scenarios.flatMap(
            value => [
                JSON.stringify(value),
                JSON.stringify(value, null, 2),
            ],
        );
    }

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
        const node = parser.parse();

        node.rebuild();

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
        format?: Partial<Formatting>,
    };

    it.each<ManipulationScenario>([
        {
            description: 'use tab only if the input is indented with tabs',
            // language=JSON
            input: json`
            {
              \t\r"foo": 1
            }`,
            // language=JSON
            output: json`
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
            input: json`
            {
            \t"foo": 1
            }`,
            // language=JSON
            output: json`
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
            input: json`
            {
            \t"foo": []
            }`,
            // language=JSON
            output: json`
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
            input: json`
            {
              "foo": 1,
            \t"bar": 2
            }`,
            // language=JSON
            output: json`
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
            input: json`
            [
             1,
            \t2
            ]`,
            // language=JSON
            output: json`
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
            input: json`{}`,
            // language=JSON
            output: json`{"foo":1}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
        },
        {
            description: 'add an element to an empty array with no indentation or spacing',
            // language=JSON
            input: json`[]`,
            // language=JSON
            output: json`[1,2]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1, 2);
            },
        },
        {
            description: 'add a property to an empty object with spacing but no indentation',
            // language=JSON
            input: json`{}`,
            // language=JSON
            output: json`{"foo": 1}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                spaced: true,
            },
        },
        {
            description: 'add an element to an empty array with spacing but no indentation',
            // language=JSON
            input: json`[]`,
            // language=JSON
            output: json`[1, 2]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1, 2);
            },
            format: {
                spaced: true,
            },
        },
        {
            description: 'add a property to an empty object with indentation but no spacing',
            // language=JSON
            input: json`{}`,
            // language=JSON
            output: json`
            {
              "foo":1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                indentationSize: 2,
            },
        },
        {
            description: 'add an element to an empty array with indentation but no spacing',
            // language=JSON
            input: json`[]`,
            // language=JSON
            output: json`
            [
              1,
              2
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1, 2);
            },
            format: {
                indentationSize: 2,
            },
        },
        {
            description: 'add a property to an empty object with indentation and spacing',
            // language=JSON
            input: json`{}`,
            // language=JSON
            output: json`
            {
              "foo": 1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                spaced: true,
                indentationSize: 2,
            },
        },
        {
            description: 'add an element to an empty array with indentation and spacing',
            // language=JSON
            input: json`[]`,
            // language=JSON
            output: json`
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
                spaced: true,
                indentationSize: 2,
            },
        },
        {
            description: 'set a nested property with the same indentation and spacing as the parent',
            // language=JSON
            input: json`
            {
              "foo": {}
            }`,
            // language=JSON
            output: json`
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
            input: json`
            [
              []
            ]`,
            // language=JSON
            output: json`
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
            input: json`
            {
              "foo": 1,
               "bar":2,
                "baz": 3
            }`,
            // language=JSON
            output: json`
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
            input: json`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: json`
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
            input: json`
            {
              "foo": 1,
               "bar":2,
                "baz": 3
            }`,
            // language=JSON
            output: json`
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
            input: json`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: json`
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
            input: json`
            [
             1,
              3
            ]`,
            // language=JSON
            output: json`
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
            input: json`
            {
              "foo": 1,
               "bar":2,
                "baz": 3
            }`,
            // language=JSON
            output: json`
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
            input: json`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: json`
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
            input: json`
            {
              "foo": 1,
               "bar":2,
                "baz": 3
            }`,
            // language=JSON
            output: json`
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
            input: json`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: json`
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
            input: json`
            {
              "foo": 1,
               "bar":2,
                "baz": 3
            }`,
            // language=JSON
            output: json`
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
            input: json`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: json`
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
            input: json`
            {
              "foo": 1,
                 "bar":2,
               "baz": 3,
                 "qux": 4,
              "quux": 5
            }`,
            // language=JSON
            output: json`
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
            input: json`
            [
              1,
                 2,
               3,
                 4,
              5
            ]`,
            // language=JSON
            output: json`
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
            input: json`
            {
             "foo": 1,
              "bar": 2,
               "baz": 3
            }`,
            // language=JSON
            output: json`
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
            input: json`
            [
             1,
              2,
               3
            ]`,
            // language=JSON
            output: json`
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
            input: json`
            {"foo": 1,
             "bar": 2}`,
            // language=JSON
            output: json`
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
            input: json`
            [1,
             2]`,
            // language=JSON
            output: json`
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
            input: json`{}`,
            // language=JSON
            output: json`
            {
              "foo":1}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                indentationSize: 2,
                leadingIndentation: true,
                trailingIndentation: false,
            },
        },
        {
            description: 'add an element to an empty array with leading but no trailing indentation',
            // language=JSON
            input: json`[]`,
            // language=JSON
            output: json`
            [
              1]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
            format: {
                indentationSize: 2,
                leadingIndentation: true,
                trailingIndentation: false,
            },
        },
        {
            description: 'add a property to an empty object with no leading but trailing indentation',
            // language=JSON
            input: json`{}`,
            // language=JSON
            output: json`
            {"foo":1
            }`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.set('foo', 1);
            },
            format: {
                indentationSize: 2,
                leadingIndentation: false,
                trailingIndentation: true,
            },
        },
        {
            description: 'add an element to an empty array with no leading but trailing indentation',
            // language=JSON
            input: json`[]`,
            // language=JSON
            output: json`
            [1
            ]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push(1);
            },
            format: {
                indentationSize: 2,
                leadingIndentation: false,
                trailingIndentation: true,
            },
        },
        {
            description: 'preserve the innermost leading and trailing indentation when adding a new property',
            // language=JSON
            input: json`
            {
              "foo": {"bar": 1}
            }`,
            // language=JSON
            output: json`
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
            input: json`
            [
              [1]
            ]`,
            // language=JSON
            output: json`
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
            input: json`
              {"foo": 1, "bar":2,
                "baz": [
                  3, 4
                ]}`,
            // language=JSON
            output: json`
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
            input: json`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4
                ]}`,
            // language=JSON
            output: json`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4,
                5
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
            input: json`
              {"foo": 1, "bar":2,
                "baz": {
                  "qux": 3, "quux": 4, "quuz": 5
                }}`,
            // language=JSON
            output: json`
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
            input: json`
              {"foo": 1, "bar":2,
                "baz": [
                  3, 4, 5
                ]}`,
            // language=JSON
            output: json`
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
            input: json`
              {"foo": 1, "bar":2,
                "baz": {
                  "qux": 3, "quux": 4, "quuz": 5
                }}`,
            // language=JSON
            output: json`
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
            input: json`
              {"foo": 1, "bar":2,
                "baz": [
                  3, 4, 5
                ]}`,
            // language=JSON
            output: json`
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
            input: json`
              {"foo": 1, "bar":2,
                "baz": {
                  "qux": 3, "quux": 4, "quuz": 5
                }}`,
            // language=JSON
            output: json`
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
            input: json`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4
                ]}`,
            // language=JSON
            output: json`
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
            description: 'preserve mixed formatting when deleting the last property',
            // language=JSON
            input: json`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
                }}`,
            // language=JSON
            output: json`
            {"foo": 1, "bar":2}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                node.delete('baz');
            },
        },
        {
            description: 'preserve mixed formatting when deleting the last element',
            // language=JSON
            input: json`
            [1, 2,
              [3, 4, 5]]`,
            // language=JSON
            output: json`
            [1, 2]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.delete(2);
            },
        },
        {
            description: 'preserve mixed formatting when deleting all properties',
            // language=JSON
            input: json`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
                }}`,
            // language=JSON
            output: json`
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
            input: json`
            {"foo": 1, "bar":2,
              "baz": {
                "qux": 3, "quux": 4, "quuz": 5
                }}`,
            // language=JSON
            output: json`
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
            input: json`
            [1, 2,
              [3, 4, 5]]`,
            // language=JSON
            output: json`
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
            input: json`
            {"foo": 1, "bar":2,
              "baz": [
                3, 4, 5
                ]}`,
            // language=JSON
            output: json`
            {"foo": 1, "bar":2,
              "baz": []}`,
            type: JsonObjectNode,
            mutation: (node: JsonObjectNode): void => {
                const baz = node.get('baz', JsonArrayNode);

                baz.clear();
            },
        },
        {
            description: 'preserve absence of formatting when adding a new property',
            // language=JSON
            input: json`
            {"foo":1}`,
            // language=JSON
            output: json`
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
            input: json`
            [1]`,
            // language=JSON
            output: json`
            [1,[{"foo":2}],[3,4]]`,
            type: JsonArrayNode,
            mutation: (node: JsonArrayNode): void => {
                node.push([{foo: 2}], [3, 4]);
            },
        },
    ])('should $description', ({input, output, type, mutation, format}) => {
        const parser = new JsonParser(input);

        const node = parser.parse(type);

        mutation(node);

        node.rebuild(format);

        expect(node.toString()).toBe(output);
    });
});

function json(strings: TemplateStringsArray): string {
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
