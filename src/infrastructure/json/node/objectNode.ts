import {JsonObject, JsonValue} from '@croct/json';
import {JsonValueNode} from './valueNode';
import {JsonNode} from './node';
import {JsonStructureNode} from './structureNode';
import {JsonTokenType} from '@/infrastructure/json/token';
import {JsonPropertyNode} from './propertyNode';
import {JsonCompositeDefinition, JsonCompositeNode, PartialJsonCompositeDefinition} from './compositeNode';
import {JsonTokenNode} from '@/infrastructure/json/node/tokenNode';
import {JsonPrimitiveNode} from '@/infrastructure/json/node/primitiveNode';
import {JsonValueFactory} from '@/infrastructure/json/node/factory';

export interface JsonObjectDefinition extends JsonCompositeDefinition {
    readonly properties: readonly JsonPropertyNode[];
}

export class JsonObjectNode extends JsonStructureNode implements JsonCompositeDefinition {
    private readonly propertyNodes: JsonPropertyNode[];

    public constructor(definition: PartialJsonCompositeDefinition<JsonObjectDefinition>) {
        super(definition);

        this.propertyNodes = [...definition.properties];
    }

    public static of(properties: Record<string, JsonValueNode|JsonValue>): JsonObjectNode {
        return new JsonObjectNode({
            properties: Object.entries(properties).map(
                ([key, value]) => new JsonPropertyNode({
                    key: JsonPrimitiveNode.of(key),
                    value: JsonValueFactory.create(value),
                }),
            ),
        });
    }

    protected getList(): JsonCompositeNode[] {
        return [...this.propertyNodes];
    }

    protected getStartToken(): JsonTokenNode {
        return new JsonTokenNode({
            type: JsonTokenType.OBJECT_START,
            value: '{',
        });
    }

    protected getEndToken(): JsonTokenNode {
        return new JsonTokenNode({
            type: JsonTokenType.OBJECT_END,
            value: '}',
        });
    }

    public has(name: string): boolean {
        return name in this.propertyNodes;
    }

    public get properties(): JsonPropertyNode[] {
        return [...this.propertyNodes];
    }

    public set(name: string, value: JsonValue|JsonValueNode): void {
        const index = this.propertyNodes.findIndex(current => current.key.toJSON() === name);

        if (index >= 0) {
            this.propertyNodes[index].set(value);

            return;
        }

        this.propertyNodes.push(
            new JsonPropertyNode({
                key: JsonPrimitiveNode.of(name),
                value: JsonValueFactory.create(value),
            }),
        );
    }

    public delete(name: string): void {
        for (let index = 0; index < this.propertyNodes.length; index++) {
            const property = this.propertyNodes[index];

            if (property.key.toJSON() === name) {
                this.propertyNodes.splice(index, 1);

                break;
            }
        }
    }

    public get<T extends JsonValueNode>(name: string, type: new (...args: any[]) => T): T;

    public get(name: string): JsonValueNode;

    public get<T extends JsonValueNode>(name: string, type?: new (...args: any[]) => T): JsonNode {
        const property = this.propertyNodes.find(current => current.key.toJSON() === name);

        if (property === undefined) {
            throw new Error(`Property "${name}" does not exist.`);
        }

        const {value} = property;

        if (type !== undefined && !(value instanceof type)) {
            throw new Error(`Expected a value of type ${type.name}, but got ${value.constructor.name}`);
        }

        return value;
    }

    public clone(): JsonObjectNode {
        return new JsonObjectNode({
            properties: this.propertyNodes,
            children: this.children.map(child => child.clone()),
            location: this.location,
        });
    }

    public isEquivalent(other: JsonNode): boolean {
        if (!(other instanceof JsonObjectNode)) {
            return false;
        }

        if (this.properties.length !== other.properties.length) {
            return false;
        }

        const entries = Object.fromEntries(other.properties.map(property => [property.key.toJSON(), property]));

        return this.properties.every(property => entries[property.key.toJSON()]?.isEquivalent(property) === true);
    }

    public toJSON(): JsonObject {
        return Object.fromEntries(
            this.properties.map(
                property => [
                    property.key.toJSON(),
                    property.value.toJSON(),
                ],
            ),
        );
    }
}
