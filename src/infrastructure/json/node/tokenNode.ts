import {JsonToken, JsonTokenType} from '../token';
import {JsonNode, JsonNodeDefinition, PartialJsonNodeDefinition} from './node';

export interface JsonTokenDefinition<T extends JsonTokenType = JsonTokenType> extends JsonNodeDefinition, JsonToken<T> {
}

export class JsonTokenNode<T extends JsonTokenType = JsonTokenType> extends JsonNode implements JsonTokenDefinition<T> {
    public readonly type: T;

    public readonly value: string;

    public constructor(definition: PartialJsonNodeDefinition<JsonTokenDefinition<T>>) {
        super(definition);

        this.type = definition.type;
        this.value = definition.value;
    }

    public clone(): JsonNode {
        return new JsonTokenNode({
            type: this.type,
            value: this.value,
            location: this.location,
        });
    }

    public isEquivalent(other: JsonNode): boolean {
        return other instanceof JsonTokenNode
            && this.type === other.type && this.value === other.value;
    }

    public toString(): string {
        return this.value;
    }
}
