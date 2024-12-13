import {JsonPrimitive, JsonValue} from '@croct/json';
import {Formatting, JsonNode} from './node';
import {JsonValueNode} from './valueNode';
import {JsonCompositeDefinition, PartialJsonCompositeDefinition} from './compositeNode';
import {NodeManipulator} from '../manipulator';
import {JsonTokenNode} from './tokenNode';
import {JsonPrimitiveTokenType, JsonPrimitiveValue, JsonTokenType} from '../token';
import {JsonValueFactory} from '@/infrastructure/json/node/factory';

export interface JsonPrimitiveDefinition<T extends JsonPrimitiveTokenType> extends JsonCompositeDefinition {
    readonly token: JsonTokenNode<T>;
    readonly value: JsonPrimitiveValue<T>;
}

export type JsonStringNode = JsonPrimitiveNode<JsonTokenType.STRING>;

export type JsonNumberNode = JsonPrimitiveNode<JsonTokenType.NUMBER>;

export type JsonBooleanNode = JsonPrimitiveNode<JsonTokenType.BOOLEAN>;

export type JsonNullNode = JsonPrimitiveNode<JsonTokenType.NULL>;

export class JsonPrimitiveNode<T extends JsonPrimitiveTokenType = JsonPrimitiveTokenType>
    extends JsonValueNode implements JsonPrimitiveDefinition<T> {
    public readonly token: JsonTokenNode<T>;

    public readonly value: JsonPrimitiveValue<T>;

    public constructor(definition: PartialJsonCompositeDefinition<JsonPrimitiveDefinition<T>>) {
        super(definition);

        this.token = definition.token;
        this.value = definition.value;
    }

    public static of(value: string): JsonStringNode;

    public static of(value: number): JsonNumberNode;

    public static of(value: boolean): JsonBooleanNode;

    public static of(value: null): JsonNullNode;

    public static of(value: JsonPrimitiveNode): JsonPrimitiveNode;

    public static of(value: JsonPrimitive|JsonPrimitiveNode): JsonPrimitiveNode {
        return JsonValueFactory.create(value);
    }

    public static ofHex(value: number): JsonNumberNode {
        return new JsonPrimitiveNode({
            token: new JsonTokenNode({
                type: JsonTokenType.NUMBER,
                value: `"0x${value.toString(16)}"`,
            }),
            value: value,
        });
    }

    public update(other: JsonValueNode|JsonValue): JsonValueNode {
        const node = JsonValueFactory.create(other);

        if (!this.isEquivalent(node)) {
            return node;
        }

        return this;
    }

    public reset(): void {
        this.children.length = 0;
    }

    public rebuild(formatting?: Formatting): void {
        const manipulator = new NodeManipulator(this.children);

        // eslint-disable-next-line prefer-destructuring -- Type widening
        let token: JsonTokenNode = this.token;

        if (token.isType(JsonTokenType.STRING) && manipulator.done()) {
            const quotes = formatting?.string?.quote;

            if (quotes === 'single') {
                let value = JSON.stringify(this.value)
                    .slice(1, -1)
                    // Unescape double quotes
                    .replace(/((?:^|[^\\])(?:\\\\)*)\\"/g, (_, preceding) => `${preceding}"`)
                    // Escape single quotes
                    .replace(/'/g, "\\'");

                value = `'${value}'`;

                token = new JsonTokenNode({
                    type: JsonTokenType.STRING,
                    value: value,
                });
            }
        }

        manipulator.node(token);
        manipulator.end();
    }

    public clone(): JsonPrimitiveNode<T> {
        return new JsonPrimitiveNode({
            token: this.token,
            value: this.value,
            children: this.children.map(child => child.clone()),
            location: this.location,
        });
    }

    public isEquivalent(other: JsonNode): boolean {
        return other instanceof JsonPrimitiveNode
            && this.token.equals(other.token)
            && this.value === other.value;
    }

    public toJSON(): JsonPrimitiveValue<T> {
        return this.value;
    }
}
