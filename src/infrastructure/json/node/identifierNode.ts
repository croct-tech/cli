import {JsonValue} from '@croct/json';
import {JsonNode} from './node';
import {JsonValueNode} from './valueNode';
import {JsonCompositeDefinition, PartialJsonCompositeDefinition} from './compositeNode';
import {NodeManipulator} from '../manipulator';
import {JsonTokenNode} from './tokenNode';
import {JsonTokenType} from '../token';
import {JsonValueFactory} from '@/infrastructure/json/node/factory';
import {isiIdentifier} from '@/infrastructure/json/identifier';

export interface JsonIdentifierDefinition extends JsonCompositeDefinition {
    readonly token: JsonTokenNode<JsonTokenType.IDENTIFIER>;
}

export class JsonIdentifierNode extends JsonValueNode implements JsonIdentifierDefinition {
    public readonly token: JsonTokenNode<JsonTokenType.IDENTIFIER>;

    public constructor(definition: PartialJsonCompositeDefinition<JsonIdentifierDefinition>) {
        super(definition);

        this.token = definition.token;
    }

    public static of(name: string): JsonIdentifierNode {
        if (!isiIdentifier(name)) {
            throw new Error(`Invalid identifier: ${name}`);
        }

        return new JsonIdentifierNode({
            token: new JsonTokenNode({
                type: JsonTokenType.IDENTIFIER,
                value: name,
            }),
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

    public rebuild(): void {
        new NodeManipulator(this.children).node(this.token).end();
    }

    public clone(): JsonIdentifierNode {
        return new JsonIdentifierNode({
            token: this.token,
            children: this.children.map(child => child.clone()),
            location: this.location,
        });
    }

    public isEquivalent(other: JsonNode): boolean {
        return other instanceof JsonIdentifierNode
            && this.token.equals(other.token);
    }

    public toJSON(): string {
        return this.token.value;
    }
}
