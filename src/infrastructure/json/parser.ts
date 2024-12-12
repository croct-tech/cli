import {JsonLexer} from './lexer';
import {JsonArrayNode, JsonNode, JsonObjectNode, JsonPrimitiveNode, JsonTokenNode, JsonValueNode} from './node';
import {JsonToken, JsonTokenType} from './token';
import {JsonPropertyNode} from '@/infrastructure/json/node/propertyNode';
import {JsonIdentifierNode} from '@/infrastructure/json/node/identifierNode';

export class JsonParser {
    private readonly lexer: JsonLexer;

    public constructor(source: string) {
        this.lexer = new JsonLexer(source);
    }

    public static parse<T extends JsonValueNode>(source: string, type: {new(...args: any[]): T}): T;

    public static parse(source: string): JsonValueNode;

    public static parse<T extends JsonValueNode>(source: string, type?: {new(...args: any[]): T}): JsonValueNode {
        const parser = new JsonParser(source);

        if (type !== undefined) {
            return parser.parseValue(type);
        }

        return parser.parseValue();
    }

    public parseValue<T extends JsonValueNode>(type: {new(...args: any[]): T}): T;

    public parseValue(): JsonValueNode;

    public parseValue<T extends JsonValueNode>(type?: {new(...args: any[]): T}): JsonValueNode {
        const node = this.parseRoot();

        if (type !== undefined && !(node instanceof type)) {
            throw new Error(`Expected ${type.name} but got ${node.constructor.name}`);
        }

        return node;
    }

    private parseRoot(): JsonValueNode {
        this.lexer.next();

        const leadingTokens = this.lexer.skipInsignificant();

        const node = this.parseNext();

        const trailingTokens = this.lexer.skipInsignificant();

        node.children.unshift(...JsonParser.createChildren(leadingTokens));
        node.children.push(...JsonParser.createChildren(trailingTokens));

        if (!this.lexer.isEof()) {
            const token = this.lexer.peek();
            const position = token.location.start;

            throw new Error(`Unexpected token '${token.type}' at ${position.line}:${position.column}`);
        }

        return node;
    }

    private parseNext(): JsonValueNode {
        const token = this.lexer.peek();

        switch (token.type) {
            case JsonTokenType.BRACE_LEFT:
                return this.parseObject();

            case JsonTokenType.BRACKET_LEFT:
                return this.parseArray();

            case JsonTokenType.NUMBER:
                return this.parseNumber();

            case JsonTokenType.STRING:
                return this.parseString();

            case JsonTokenType.BOOLEAN:
                return this.parseBoolean();

            case JsonTokenType.NULL:
                return this.parseNull();

            default: {
                const position = token.location.start;

                throw new Error(`Unexpected token '${token.type}' at ${position.line}:${position.column}`);
            }
        }
    }

    private parseNumber(): JsonPrimitiveNode<JsonTokenType.NUMBER> {
        const token = this.lexer.consume(JsonTokenType.NUMBER);
        const tokenNode = new JsonTokenNode(token);

        return new JsonPrimitiveNode({
            token: tokenNode,
            value: this.parseNumberValue(token),
            children: [tokenNode],
            location: token.location,
        });
    }

    private parseNumberValue(token: JsonToken<JsonTokenType.NUMBER>): number {
        let {value} = token;

        let sign = 1;

        if (value.startsWith('+')) {
            value = value.slice(1);
        } else if (value.startsWith('-')) {
            sign = -1;
            value = value.slice(1);
        }

        if (value === 'Infinity') {
            return sign * Infinity;
        }

        if (value === 'NaN') {
            return NaN;
        }

        if (value.startsWith('.')) {
            value = `0${value}`;
        } else {
            value = value.replace(/\.(?!\d)/, '');
        }

        if (value.startsWith('0x') || value.startsWith('0X')) {
            return sign * Number.parseInt(value, 16);
        }

        return sign * JSON.parse(value);
    }

    private parseString(): JsonPrimitiveNode<JsonTokenType.STRING> {
        const token = this.lexer.consume(JsonTokenType.STRING);

        let {value} = token;

        if (value.startsWith("'")) {
            value = value.slice(1, -1)
                // Unescape single quotes and escape double quotes
                .replace(
                    /((?:^|[^\\])(?:\\\\)*)\\(["'])/g,
                    (_, preceding, quote) => `${preceding}${quote === '"' ? '\\"' : "'"}`,
                );

            value = `"${value}"`;
        }

        value = value.replace(/\\(?:\r\n|\r|\n|\u2028|\u2029)/gu, '');

        const tokenNode = new JsonTokenNode(token);

        return new JsonPrimitiveNode({
            token: tokenNode,
            value: JSON.parse(value),
            children: [tokenNode],
            location: token.location,
        });
    }

    private parseNull(): JsonPrimitiveNode<JsonTokenType.NULL> {
        const token = this.lexer.consume(JsonTokenType.NULL);
        const tokenNode = new JsonTokenNode(token);

        return new JsonPrimitiveNode({
            token: tokenNode,
            value: null,
            children: [tokenNode],
            location: token.location,
        });
    }

    private parseBoolean(): JsonPrimitiveNode<JsonTokenType.BOOLEAN> {
        const token = this.lexer.consume(JsonTokenType.BOOLEAN);
        const tokenNode = new JsonTokenNode(token);

        return new JsonPrimitiveNode({
            token: tokenNode,
            value: token.value === 'true',
            children: [tokenNode],
            location: token.location,
        });
    }

    private parseArray(): JsonArrayNode {
        const children: Array<JsonNode|JsonToken> = [
            this.lexer.consume(JsonTokenType.BRACKET_LEFT),
            ...this.lexer.skipInsignificant(),
        ];

        const elements: JsonValueNode[] = [];

        while (!this.lexer.matches(JsonTokenType.BRACKET_RIGHT)) {
            const element = this.parseNext();

            elements.push(element);

            children.push(element, ...this.lexer.skipInsignificant());

            if (!this.lexer.matches(JsonTokenType.BRACKET_RIGHT)) {
                children.push(this.lexer.consume(JsonTokenType.COMMA), ...this.lexer.skipInsignificant());
            }
        }

        children.push(this.lexer.consume(JsonTokenType.BRACKET_RIGHT));

        return new JsonArrayNode({
            elements: elements,
            children: JsonParser.createChildren(children),
            location: {
                start: children[0].location.start,
                end: children[children.length - 1].location.end,
            },
        });
    }

    private parseObject(): JsonObjectNode {
        const children: Array<JsonNode|JsonToken> = [
            this.lexer.consume(JsonTokenType.BRACE_LEFT),
            ...this.lexer.skipInsignificant(),
        ];

        const properties: JsonPropertyNode[] = [];

        while (!this.lexer.matches(JsonTokenType.BRACE_RIGHT)) {
            const property = this.parseObjectProperty();

            properties.push(property);

            children.push(property, ...this.lexer.skipInsignificant());

            if (!this.lexer.matches(JsonTokenType.BRACE_RIGHT)) {
                children.push(this.lexer.consume(JsonTokenType.COMMA), ...this.lexer.skipInsignificant());
            }
        }

        children.push(this.lexer.consume(JsonTokenType.BRACE_RIGHT));

        return new JsonObjectNode({
            properties: properties,
            children: JsonParser.createChildren(children),
            location: {
                start: children[0].location.start,
                end: children[children.length - 1].location.end,
            },
        });
    }

    private parseObjectProperty(): JsonPropertyNode {
        const children: Array<JsonNode|JsonToken> = [];

        this.lexer.expect(JsonTokenType.STRING, JsonTokenType.IDENTIFIER);

        const key = this.lexer.matches(JsonTokenType.STRING)
            ? this.parseString()
            : this.parseIdentifier();

        children.push(
            key,
            ...this.lexer.skipInsignificant(),
            this.lexer.consume(JsonTokenType.COLON),
            ...this.lexer.skipInsignificant(),
        );

        const value = this.parseNext();

        children.push(value);

        return new JsonPropertyNode({
            key: key,
            value: value,
            children: JsonParser.createChildren(children),
            location: {
                start: children[0].location.start,
                end: children[children.length - 1].location.end,
            },
        });
    }

    private parseIdentifier(): JsonIdentifierNode {
        const token = this.lexer.consume(JsonTokenType.IDENTIFIER);
        const tokenNode = new JsonTokenNode(token);

        return new JsonIdentifierNode({
            token: tokenNode,
            children: [tokenNode],
            location: token.location,
        });
    }

    private static createChildren(children: Array<JsonNode|JsonToken>): JsonNode[] {
        return children.map(child => {
            if (child instanceof JsonNode) {
                return child;
            }

            return new JsonTokenNode(child);
        });
    }
}
