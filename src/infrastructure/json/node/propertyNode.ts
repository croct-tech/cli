import {JsonValue} from '@croct/json';
import {JsonValueNode} from './valueNode';
import {Formatting, JsonNode} from './node';
import {JsonTokenNode} from '@/infrastructure/json/node/tokenNode';
import {JsonTokenType} from '@/infrastructure/json/token';
import {JsonCompositeDefinition, JsonCompositeNode, PartialJsonCompositeDefinition} from './compositeNode';
import {NodeManipulator} from '@/infrastructure/json/manipulator';
import {JsonValueFactory} from '@/infrastructure/json/node/factory';
import {JsonIdentifierNode} from '@/infrastructure/json/node/identifierNode';
import {isiIdentifier} from '@/infrastructure/json/identifier';
import {JsonPrimitiveNode} from '@/infrastructure/json/node/primitiveNode';

export interface JsonPropertyDefinition extends JsonCompositeDefinition {
    readonly key: JsonPrimitiveNode<JsonTokenType.STRING> | JsonIdentifierNode;
    value: JsonValueNode;
}

export class JsonPropertyNode extends JsonCompositeNode implements JsonPropertyDefinition {
    public readonly key: JsonPrimitiveNode<JsonTokenType.STRING> | JsonIdentifierNode;

    public value: JsonValueNode;

    public constructor(definition: PartialJsonCompositeDefinition<JsonPropertyDefinition>) {
        super(definition);

        this.key = definition.key;
        this.value = definition.value;
    }

    public reset(): void {
        this.key.reset();
        this.value.reset();

        this.children.length = 0;
    }

    public set(value: JsonValue | JsonValueNode): void {
        this.value = JsonValueFactory.create(value);
    }

    public rebuild(formatting?: Formatting): void {
        this.value.rebuild(formatting);

        const quote = formatting?.property?.quote;
        const spaced = formatting?.object?.colonSpacing ?? false;

        const manipulator = new NodeManipulator(this.children);

        let {key} = this;

        if (manipulator.matches(this.key)) {
            key.rebuild();
        } else {
            key = this.formatKey(formatting);

            key.rebuild({
                ...formatting,
                string: {
                    quote: quote === 'single' || quote === 'double'
                        ? quote
                        : formatting?.string?.quote,
                },
            });
        }

        manipulator.node(key);

        manipulator.token(
            new JsonTokenNode({
                type: JsonTokenType.COLON,
                value: ':',
            }),
        );

        if (spaced) {
            manipulator.token(
                new JsonTokenNode({
                    type: JsonTokenType.WHITESPACE,
                    value: ' ',
                }),
                !manipulator.done(),
            );
        }

        manipulator.node(this.value)
            .end();
    }

    private formatKey(formatting?: Formatting): JsonPrimitiveNode<JsonTokenType.STRING> | JsonIdentifierNode {
        if (
            this.key instanceof JsonPrimitiveNode
            && formatting?.property?.unquoted === true
            && isiIdentifier(this.key.value)
        ) {
            return JsonIdentifierNode.of(this.key.value);
        }

        return this.key;
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
