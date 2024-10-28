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

    public toString(formatting?: Partial<Formatting>): string {
        const clone = this.clone();

        clone.rebuild(formatting);

        return clone.children.join('');
    }

    public abstract clone(): JsonCompositeNode;

    public abstract reset(): void;

    public reformat(formatting: Partial<Formatting> = {}): void {
        this.reset();
        this.rebuild(formatting);
    }

    public abstract rebuild(formatting?: Partial<Formatting>): void;
}
