import {JsonArray, JsonValue} from '@croct/json';
import {JsonValueNode} from './valueNode';
import {JsonStructureNode} from './structureNode';
import {JsonTokenType} from '../token';
import {JsonCompositeDefinition, JsonCompositeNode, PartialJsonCompositeDefinition} from './compositeNode';
import {JsonTokenNode} from './tokenNode';
import {JsonValueFactory} from './factory';

export interface JsonArrayDefinition extends JsonCompositeDefinition {
    readonly elements: readonly JsonValueNode[];
}

export class JsonArrayNode extends JsonStructureNode implements JsonArrayDefinition {
    private readonly elementNodes: JsonValueNode[];

    public constructor(definition: PartialJsonCompositeDefinition<JsonArrayDefinition>) {
        super(definition);

        this.elementNodes = [...definition.elements];
    }

    public static of(...elements: readonly JsonValue[]): JsonArrayNode {
        return new JsonArrayNode({
            elements: elements.map(JsonValueFactory.create),
        });
    }

    protected getList(): JsonCompositeNode[] {
        return [...this.elementNodes];
    }

    protected getStartToken(): JsonTokenNode {
        return new JsonTokenNode({
            type: JsonTokenType.ARRAY_START,
            value: '[',
        });
    }

    protected getEndToken(): JsonTokenNode {
        return new JsonTokenNode({
            type: JsonTokenType.ARRAY_END,
            value: ']',
        });
    }

    public get elements(): readonly JsonValueNode[] {
        return [...this.elementNodes];
    }

    public get<T extends JsonValueNode>(index: number, type: new (...args: any[]) => T): T {
        const element = this.elementNodes[index];

        if (!(element instanceof type)) {
            throw new Error(`Expected ${type.name} at index ${index} but got ${element.constructor.name}`);
        }

        return element;
    }

    public set(index: number, element: JsonValue|JsonValueNode): void {
        if (index < 0 || index >= this.elementNodes.length) {
            throw new Error(`Index ${index} is out of bounds.`);
        }

        this.elementNodes[index] = JsonValueFactory.create(element);
    }

    public clear(): void {
        this.elementNodes.length = 0;
    }

    public delete(index: number): void {
        if (index < 0 || index >= this.elementNodes.length) {
            throw new Error(`Index ${index} is out of bounds.`);
        }

        this.splice(index, 1);
    }

    public unshift(...elements: Array<JsonValue|JsonValueNode>): void {
        this.elementNodes.unshift(...elements.map(JsonValueFactory.create));
    }

    public push(...elements: Array<JsonValue|JsonValueNode>): void {
        this.elementNodes.push(...elements.map(JsonValueFactory.create));
    }

    public shift(): JsonValueNode|undefined {
        return this.elementNodes.shift();
    }

    public pop(): JsonValueNode|undefined {
        return this.elementNodes.pop();
    }

    public splice(start: number, deleteCount: number, ...elements: Array<JsonValue|JsonValueNode>): JsonValueNode[] {
        return this.elementNodes.splice(start, deleteCount, ...elements.map(JsonValueFactory.create));
    }

    public clone(): JsonArrayNode {
        return new JsonArrayNode({
            children: this.children.map(child => child.clone()),
            elements: this.elementNodes,
            location: this.location,
        });
    }

    public isEquivalent(other: JsonValueNode): boolean {
        if (!(other instanceof JsonArrayNode)) {
            return false;
        }

        if (this.elements.length !== other.elements.length) {
            return false;
        }

        return this.elements.every((element, index) => other.elements[index].isEquivalent(element));
    }

    public toJSON(): JsonArray {
        return this.elements.map(element => element.toJSON());
    }
}
