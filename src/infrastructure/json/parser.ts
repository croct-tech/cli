import {JsonLexer} from './lexer';
import {JsonArrayNode, JsonNode, JsonObjectNode, JsonPrimitiveNode, JsonTokenNode, JsonValueNode} from './node';
import {JsonToken, JsonTokenType} from './token';
import {JsonPropertyNode} from '@/infrastructure/json/node/propertyNode';

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

        const leadingSpaces = this.lexer.skipSpace();

        const node = this.parseNext();

        const trailingSpaces = this.lexer.skipSpace();

        node.children.unshift(...JsonParser.createChildren(leadingSpaces));
        node.children.push(...JsonParser.createChildren(trailingSpaces));

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

            case JsonTokenType.STRING:
            case JsonTokenType.NUMBER:
            case JsonTokenType.BOOLEAN:
            case JsonTokenType.NULL:
                return this.parsePrimitive();

            default: {
                const position = token.location.start;

                throw new Error(`Unexpected token '${token.type}' at ${position.line}:${position.column}`);
            }
        }
    }

    private parsePrimitive(): JsonPrimitiveNode {
        const token = this.lexer.consume(
            JsonTokenType.STRING,
            JsonTokenType.NUMBER,
            JsonTokenType.BOOLEAN,
            JsonTokenType.NULL,
        );

        const tokenNode = new JsonTokenNode(token);

        return new JsonPrimitiveNode({
            token: tokenNode,
            value: JSON.parse(token.value),
            children: [tokenNode],
            location: token.location,
        });
    }

    private parseArray(): JsonArrayNode {
        const children: Array<JsonNode|JsonToken> = [
            this.lexer.consume(JsonTokenType.BRACKET_LEFT),
            ...this.lexer.skipSpace(),
        ];

        const elements: JsonValueNode[] = [];

        while (!this.lexer.matches(JsonTokenType.BRACKET_RIGHT)) {
            const element = this.parseNext();

            elements.push(element);

            children.push(element, ...this.lexer.skipSpace());

            if (!this.lexer.matches(JsonTokenType.BRACKET_RIGHT)) {
                children.push(this.lexer.consume(JsonTokenType.COMMA), ...this.lexer.skipSpace());
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
            ...this.lexer.skipSpace(),
        ];

        const properties: JsonPropertyNode[] = [];

        while (!this.lexer.matches(JsonTokenType.BRACE_RIGHT)) {
            const property = this.parseObjectProperty();

            properties.push(property);

            children.push(property, ...this.lexer.skipSpace());

            if (!this.lexer.matches(JsonTokenType.BRACE_RIGHT)) {
                children.push(this.lexer.consume(JsonTokenType.COMMA), ...this.lexer.skipSpace());
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
        const keyToken = this.lexer.consume(JsonTokenType.STRING);
        const keyTokenNode = new JsonTokenNode(keyToken);

        const key = new JsonPrimitiveNode<JsonTokenType.STRING>({
            token: keyTokenNode,
            value: JSON.parse(keyToken.value),
            children: [keyTokenNode],
            location: keyToken.location,
        });

        children.push(
            key,
            ...this.lexer.skipSpace(),
            this.lexer.consume(JsonTokenType.COLON),
            ...this.lexer.skipSpace(),
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

    private static createChildren(children: Array<JsonNode|JsonToken>): JsonNode[] {
        return children.map(child => {
            if (child instanceof JsonNode) {
                return child;
            }

            return new JsonTokenNode(child);
        });
    }
}
