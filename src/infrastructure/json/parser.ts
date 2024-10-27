import {JsonLexer} from './lexer';
import {JsonArrayNode, JsonNode, JsonObjectNode, JsonPrimitiveNode, JsonTokenNode, JsonValueNode} from './node';
import {JsonToken, JsonTokenType} from './token';
import {JsonPropertyNode} from '@/infrastructure/json/node/propertyNode';

export class JsonParser {
    private readonly lexer: JsonLexer;

    public constructor(source: string) {
        this.lexer = new JsonLexer(source);
    }

    public parse<T extends JsonValueNode>(type: {new(definition: any): T}): T;

    public parse(): JsonValueNode;

    public parse<T extends JsonValueNode>(type?: {new(definition: any): T}): JsonValueNode {
        this.lexer.next();

        const node = this.parseValue();

        node.children.push(...JsonParser.createChildren(this.lexer.skipSpace()));

        if (!this.lexer.isEof()) {
            const token = this.lexer.peek();
            const position = token.location.start;

            throw new Error(`Unexpected token '${token.type}' at ${position.line}:${position.column}`);
        }

        if (type !== undefined && !(node instanceof type)) {
            throw new Error(`Expected ${type.name} but got ${node.constructor.name}`);
        }

        return node;
    }

    private parseValue(): JsonValueNode {
        const token = this.lexer.peek();

        switch (token.type) {
            case JsonTokenType.OBJECT_START:
                return this.parseObject();

            case JsonTokenType.ARRAY_START:
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
            this.lexer.consume(JsonTokenType.ARRAY_START),
            ...this.lexer.skipSpace(),
        ];

        const elements: JsonValueNode[] = [];

        while (!this.lexer.matches(JsonTokenType.ARRAY_END)) {
            const element = this.parseValue();

            elements.push(element);

            children.push(element, ...this.lexer.skipSpace());

            if (!this.lexer.matches(JsonTokenType.ARRAY_END)) {
                children.push(this.lexer.consume(JsonTokenType.COMMA), ...this.lexer.skipSpace());
            }
        }

        children.push(this.lexer.consume(JsonTokenType.ARRAY_END));

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
            this.lexer.consume(JsonTokenType.OBJECT_START),
            ...this.lexer.skipSpace(),
        ];

        const properties: JsonPropertyNode[] = [];

        while (!this.lexer.matches(JsonTokenType.OBJECT_END)) {
            const property = this.parseObjectProperty();

            properties.push(property);

            children.push(property, ...this.lexer.skipSpace());

            if (!this.lexer.matches(JsonTokenType.OBJECT_END)) {
                children.push(this.lexer.consume(JsonTokenType.COMMA), ...this.lexer.skipSpace());
            }
        }

        children.push(this.lexer.consume(JsonTokenType.OBJECT_END));

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

        const value = this.parseValue();

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
