import {Formatting, JsonNode, JsonNodeDefinition} from './node';

export interface JsonCompositeDefinition extends JsonNodeDefinition {
    readonly children: JsonNode[];
}

export type PartialJsonCompositeDefinition<T extends JsonCompositeDefinition = JsonCompositeDefinition> =
    Omit<T, keyof JsonCompositeDefinition> & Partial<JsonCompositeDefinition>;

export abstract class JsonCompositeNode extends JsonNode {
    public readonly children: JsonNode[];

    protected constructor(definition: PartialJsonCompositeDefinition) {
        super(definition);

        this.children = [...(definition.children ?? [])];
    }

    public toString(formatting?: Formatting): string {
        const clone = this.clone();

        clone.rebuild(formatting);

        return JsonCompositeNode.flatten(clone).join('');
    }

    public abstract clone(): JsonCompositeNode;

    public abstract reset(): void;

    public reformat(formatting: Formatting = {}): void {
        this.reset();
        this.rebuild(formatting);
    }

    public abstract rebuild(formatting?: Formatting): void;

    private static flatten(node: JsonNode): JsonNode[] {
        if (node instanceof JsonCompositeNode) {
            return node.children.flatMap(JsonCompositeNode.flatten);
        }

        return [node];
    }
}
