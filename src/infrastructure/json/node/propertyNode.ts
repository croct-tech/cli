import {JsonValue} from '@croct/json';
import {JsonValueNode} from './valueNode';
import {JsonNode} from './node';
import {JsonTokenNode} from '@/infrastructure/json/node/tokenNode';
import {JsonTokenType} from '@/infrastructure/json/token';
import {Formatting, JsonTreeDefinition, JsonTreeNode, PartialJsonTreeDefinition} from './treeNode';
import {NodeManipulator} from '@/infrastructure/json/manipulator';
import {JsonPrimitiveNode} from './primitiveNode';
import {JsonValueFactory} from '@/infrastructure/json/node/factory';

export interface JsonPropertyDefinition extends JsonTreeDefinition {
    readonly key: JsonPrimitiveNode<JsonTokenType.STRING>;
    value: JsonValueNode;
}

export class JsonPropertyNode extends JsonTreeNode implements JsonPropertyDefinition {
    public readonly key: JsonPrimitiveNode<JsonTokenType.STRING>;

    public value: JsonValueNode;

    public constructor(definition: PartialJsonTreeDefinition<JsonPropertyDefinition>) {
        super(definition);

        this.key = definition.key;
        this.value = definition.value;
    }

    public reset(): void {
        this.key.reset();
        this.value.reset();

        this.children.length = 0;
    }

    public set(value: JsonValue|JsonValueNode): void {
        this.value = JsonValueFactory.create(value);
    }

    public rebuild(formatting?: Partial<Formatting>): void {
        this.key.rebuild();

        this.value.rebuild(formatting);

        this.rebuildChildren(formatting);
    }

    private rebuildChildren(formatting?: Partial<Formatting>): void {
        const manipulator = new NodeManipulator(this.children);
        const spaced = formatting?.spaced ?? false;

        manipulator.node(this.key)
            .token(
                new JsonTokenNode({
                    type: JsonTokenType.COLON,
                    value: ':',
                }),
            );

        if (spaced) {
            manipulator.token(
                new JsonTokenNode({
                    type: JsonTokenType.WHITESPACE,
                    value: ' '.repeat(spaced ? 1 : 0),
                }),
                !manipulator.done(),
            );
        }

        manipulator.node(this.value)
            .end();
    }

    public clone(): JsonPropertyNode {
        return new JsonPropertyNode({
            key: this.key,
            value: this.value,
            children: this.children.map(child => child.clone()),
            location: this.location,
        });
    }

    public isEquivalent(other: JsonNode): boolean {
        if (!(other instanceof JsonPropertyNode)) {
            return false;
        }

        return this.key.isEquivalent(other.key)
            && this.value.isEquivalent(other.value);
    }
}
