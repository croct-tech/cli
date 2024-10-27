import {JsonArray, JsonObject, JsonPrimitive, JsonValue} from '@croct/json';
import {JsonArrayNode} from './arrayNode';
import {JsonObjectNode} from './objectNode';
import {JsonPropertyNode} from './propertyNode';
import {JsonBooleanNode, JsonNullNode, JsonNumberNode, JsonPrimitiveNode, JsonStringNode} from './primitiveNode';
import {JsonPrimitiveTokenType, JsonTokenType} from '../token';
import {JsonTokenNode} from './tokenNode';
import {SourceLocation} from '../location';
import {JsonValueNode} from './valueNode';

export namespace JsonValueFactory {
    const tokenTypes: Record<string, JsonPrimitiveTokenType> = {
        string: JsonTokenType.STRING,
        number: JsonTokenType.NUMBER,
        boolean: JsonTokenType.BOOLEAN,
        null: JsonTokenType.NULL,
    };

    export function create(value: JsonArray|JsonArrayNode): JsonArrayNode;
    export function create(value: JsonObject|JsonObjectNode): JsonObjectNode;
    export function create(value: string|JsonStringNode): JsonStringNode;
    export function create(value: number|JsonNumberNode): JsonNumberNode;
    export function create(value: boolean|JsonBooleanNode): JsonBooleanNode;
    export function create(value: null|JsonNullNode): JsonNullNode;
    export function create(value: JsonPrimitive|JsonPrimitiveNode): JsonPrimitiveNode;
    export function create(value: JsonValue|JsonValueNode): JsonValueNode;

    export function create(value: JsonValue|JsonValueNode): JsonValueNode {
        if (value instanceof JsonValueNode) {
            return value;
        }

        if (Array.isArray(value)) {
            return new JsonArrayNode({
                elements: value.map(JsonValueFactory.create),
            });
        }

        if (typeof value === 'object' && value !== null) {
            return new JsonObjectNode({
                properties: Object.entries(value).flatMap(([propertyName, propertyValue]) => {
                    if (propertyValue === undefined) {
                        return [];
                    }

                    return [
                        new JsonPropertyNode({
                            key: JsonPrimitiveNode.of(propertyName),
                            value: create(propertyValue),
                        }),
                    ];
                }),
            });
        }

        const token = new JsonTokenNode({
            type: tokenTypes[typeof value],
            value: JSON.stringify(value),
            location: SourceLocation.unknown(),
        });

        return new JsonPrimitiveNode({
            token: token,
            value: value,
            location: SourceLocation.unknown(),
            children: [token],
        });
    }
}
