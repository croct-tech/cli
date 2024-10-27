import {JsonNode, JsonNodeDefinition} from './node';

export interface JsonTreeDefinition extends JsonNodeDefinition {
    readonly children: JsonNode[];
}

export type PartialJsonTreeDefinition<T extends JsonTreeDefinition = JsonTreeDefinition> =
    Omit<T, keyof JsonTreeDefinition> & Partial<JsonTreeDefinition>;

export type Formatting = {
    indentationLevel: number,
    indentationSize: number,
    leadingIndentation: boolean,
    trailingIndentation: boolean,
    indentationCharacter: 'space' | 'tab',
    spaced: boolean,
};

export abstract class JsonTreeNode extends JsonNode {
    public readonly children: JsonNode[];

    protected constructor(definition: PartialJsonTreeDefinition) {
        super(definition);

        this.children = [...(definition.children ?? [])];
    }

    public toString(): string {
        return this.children.join('');
    }

    public abstract reset(): void;

    public reformat(formatting: Partial<Formatting> = {}): void {
        this.reset();
        this.rebuild(formatting);
    }

    public abstract rebuild(formatting?: Partial<Formatting>): void;
}
