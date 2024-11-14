import {SourceLocation} from '../location';

export interface JsonNodeDefinition {
    readonly location: SourceLocation;
}

export type BlockFormatting = {
    indentationSize?: number,
    trailingIndentation?: boolean,
    leadingIndentation?: boolean,
    entryIndentation?: boolean,
    commaSpacing?: boolean,
    colonSpacing?: boolean,
};

export type Formatting = {
    indentationLevel?: number,
    indentationCharacter?: 'space' | 'tab',
    bracket?: BlockFormatting,
    brace?: BlockFormatting,
};

export type PartialJsonNodeDefinition<T extends JsonNodeDefinition = JsonNodeDefinition> =
    Omit<T, keyof JsonNodeDefinition> & Partial<JsonNodeDefinition>;

export abstract class JsonNode implements JsonNodeDefinition {
    public readonly location: SourceLocation;

    protected constructor(definition: PartialJsonNodeDefinition) {
        this.location = definition.location ?? SourceLocation.unknown();
    }

    public equals(other: JsonNode): boolean {
        return this.equalsLocation(other) && this.isEquivalent(other);
    }

    private equalsLocation(other: JsonNode): boolean {
        return this.location.start.index === other.location.start.index
            && this.location.start.line === other.location.start.line
            && this.location.start.column === other.location.start.column
            && this.location.end.index === other.location.end.index
            && this.location.end.line === other.location.end.line
            && this.location.end.column === other.location.end.column;
    }

    public abstract isEquivalent(other: JsonNode): boolean;

    public abstract clone(): JsonNode;

    public abstract toString(formatting?: Formatting): string;
}
