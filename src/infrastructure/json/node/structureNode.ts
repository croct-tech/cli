import {JsonValueNode} from './valueNode';
import {BlockFormatting, Formatting, JsonNode} from './node';
import {JsonTokenType} from '../token';
import {JsonTokenDefinition, JsonTokenNode} from './tokenNode';
import {NodeManipulator, NodeMatcher} from '../manipulator';
import {JsonCompositeNode} from './compositeNode';

type DescendantNode = {
    depth: number,
    token: JsonTokenNode,
};

export enum StructureDelimiter {
    BRACE = 'brace',
    BRACKET = 'bracket',
}

export namespace StructureDelimiter {
    type TokenDefinition = {
        start: Omit<JsonTokenDefinition, 'location'>,
        end: Omit<JsonTokenDefinition, 'location'>,
    };

    const definitions: Record<StructureDelimiter, TokenDefinition> = {
        [StructureDelimiter.BRACE]: {
            start: {
                type: JsonTokenType.BRACE_LEFT,
                value: '{',
            },
            end: {
                type: JsonTokenType.BRACE_RIGHT,
                value: '}',
            },
        },
        [StructureDelimiter.BRACKET]: {
            start: {
                type: JsonTokenType.BRACKET_LEFT,
                value: '[',
            },
            end: {
                type: JsonTokenType.BRACKET_RIGHT,
                value: ']',
            },
        },
    };

    export function isStartToken(token: JsonTokenNode): boolean {
        return Object.values(definitions).some(({start}) => start.type === token.type);
    }

    export function isEndToken(token: JsonTokenNode): boolean {
        return Object.values(definitions).some(({end}) => end.type === token.type);
    }

    export function getStartToken(delimiter: StructureDelimiter): JsonTokenNode {
        return new JsonTokenNode(definitions[delimiter].start);
    }

    export function getEndToken(delimiter: StructureDelimiter): JsonTokenNode {
        return new JsonTokenNode(definitions[delimiter].end);
    }
}

export abstract class JsonStructureNode extends JsonValueNode {
    public reset(): void {
        for (const item of this.getList()) {
            item.reset();
        }

        this.children.length = 0;
    }

    public rebuild(formatting: Formatting = {}): void {
        const parentFormatting = this.detectFormatting(formatting);

        let childFormatting = parentFormatting;

        const children = [...this.children];

        for (let index = 0; index < children.length; index++) {
            const child = children[index];

            if (child instanceof JsonStructureNode) {
                // Extract the formatting from the last child
                childFormatting = {
                    ...child.detectFormatting(childFormatting),
                    indentationLevel: childFormatting.indentationLevel,
                };

                continue;
            }

            if (child instanceof JsonCompositeNode && this.children.includes(child)) {
                // If the direct child is a composite node, traverse it
                children.splice(index + 1, 0, ...child.children);
            }
        }

        for (const item of this.getList()) {
            item.rebuild(childFormatting);
        }

        this.rebuildChildren(parentFormatting);
    }

    private rebuildChildren(formatting: Formatting): void {
        const manipulator = new NodeManipulator(this.children);
        const delimiter = this.getDelimiter();

        const startToken = StructureDelimiter.getStartToken(delimiter);
        const endToken = StructureDelimiter.getEndToken(delimiter);

        manipulator.token(startToken);

        const list = this.getList();
        const count = list.length;

        const {indentationLevel = 0} = formatting;

        const {
            indentationSize = 0,
            commaSpacing = false,
            entryIndentation = false,
            leadingIndentation: blockLeadingIndentation = false,
            trailingIndentation: blockTrailingIndentation = false,
        } = formatting[delimiter] ?? {};

        let previousMatched = false;

        for (let index = 0; index < count; index++) {
            const item = list[index];
            const leadingIndentation = (index !== 0 && entryIndentation) || (index === 0 && blockLeadingIndentation);

            if (JsonStructureNode.matchesInsertion(manipulator, list, index)) {
                if (leadingIndentation) {
                    this.indent(manipulator, formatting);
                }

                manipulator.insert(item);
                previousMatched = false;
            } else if (JsonStructureNode.matchesRemoval(manipulator, list, index)) {
                manipulator.dropUntil(item.isEquivalent.bind(item));
                manipulator.node(item);
                previousMatched = true;
            } else {
                const currentMatched = manipulator.matches(item);

                if (leadingIndentation) {
                    if (indentationSize > 0 && manipulator.matchesNext(node => endToken.isEquivalent(node))) {
                        // If the following token is the end token, always indent.
                        // This ensures it won't consume the indentation of the end delimiter.
                        manipulator.insert(
                            new JsonTokenNode({
                                type: JsonTokenType.NEWLINE,
                                value: '\n',
                            }),
                        );

                        manipulator.insert(this.getIndentationToken(formatting));
                    } else {
                        this.indent(manipulator, formatting, previousMatched && currentMatched);
                    }
                }

                previousMatched = currentMatched;
                manipulator.node(item);
            }

            if (index === count - 1) {
                if (blockTrailingIndentation) {
                    this.indent(manipulator, {
                        ...formatting,
                        indentationLevel: indentationLevel - 1,
                    });
                }
            } else {
                manipulator.node(
                    new JsonTokenNode({
                        type: JsonTokenType.COMMA,
                        value: ',',
                    }),
                );

                if (
                    ((indentationSize === 0 || !entryIndentation) && commaSpacing)
                    && (
                        !manipulator.matchesNext(NodeMatcher.SPACE)
                        || manipulator.matchesNext(node => endToken.isEquivalent(node))
                    )
                ) {
                    manipulator.token(
                        new JsonTokenNode({
                            type: JsonTokenType.WHITESPACE,
                            value: ' ',
                        }),
                        manipulator.matchesNext(
                            node => list[index + 1].isEquivalent(node),
                            NodeMatcher.SPACE,
                        ),
                    );
                }
            }
        }

        manipulator.token(endToken);

        manipulator.end();
    }

    protected abstract getList(): JsonCompositeNode[];

    protected abstract getDelimiter(): StructureDelimiter;

    private detectFormatting(parent: Formatting = {}): Formatting {
        let blockStart = false;
        let lineStart = true;
        let comma = false;
        let colon = false;
        let lineIndentationSize = 0;
        let levelIndentationSize = 0;
        let leadingIndentation: boolean | undefined;
        let trailingIndentation: boolean | undefined;
        let empty = true;

        const formatting: Formatting = {};
        const blockFormatting: BlockFormatting = {};

        for (const {token, depth} of JsonStructureNode.iterate(this.children, 1)) {
            if (depth === 0 && StructureDelimiter.isStartToken(token)) {
                blockStart = true;
            } else {
                const blockEnd = StructureDelimiter.isEndToken(token);

                if (depth === 0) {
                    if (blockEnd) {
                        trailingIndentation = lineStart;
                    }

                    if (blockStart) {
                        leadingIndentation = token.type === JsonTokenType.NEWLINE;

                        if (token.type !== JsonTokenType.WHITESPACE) {
                            blockStart = false;
                        }
                    }
                }

                if (!blockEnd) {
                    // Use the last indentation size as the base
                    levelIndentationSize = lineIndentationSize;

                    empty = false;
                }
            }

            if (token.type === JsonTokenType.WHITESPACE) {
                if (token.value.includes('\t')) {
                    formatting.indentationCharacter = 'tab';
                }

                if (depth === 0 && lineStart) {
                    // ignore characters that are not spaces, like \r
                    lineIndentationSize = token.value.includes('\t')
                        ? token.value.replace(/[^\t]/g, '').length
                        : token.value.replace(/[^ ]/g, '').length;
                }
            }

            if (depth === 0 && comma) {
                if (token.type !== JsonTokenType.NEWLINE) {
                    blockFormatting.commaSpacing = token.type === JsonTokenType.WHITESPACE;
                }

                blockFormatting.entryIndentation = token.type === JsonTokenType.NEWLINE;
                comma = false;
            }

            if (colon) {
                blockFormatting.colonSpacing = token.type === JsonTokenType.WHITESPACE;
                colon = false;
            }

            colon = token.type === JsonTokenType.COLON || (colon && token.type === JsonTokenType.WHITESPACE);
            comma = token.type === JsonTokenType.COMMA || (comma && token.type === JsonTokenType.WHITESPACE);

            lineStart = token.type === JsonTokenType.NEWLINE || (lineStart && token.type === JsonTokenType.WHITESPACE);
        }

        if (!empty) {
            blockFormatting.indentationSize = 0;
            blockFormatting.leadingIndentation = leadingIndentation ?? false;
            blockFormatting.trailingIndentation = trailingIndentation ?? false;
        }

        const currentDepth = Math.max(parent.indentationLevel ?? 0, 0) + 1;

        if (levelIndentationSize > 0) {
            const remainder = levelIndentationSize % currentDepth;

            blockFormatting.indentationSize = (levelIndentationSize - remainder) / currentDepth + remainder;

            if (blockFormatting.commaSpacing === undefined) {
                // If no spacing detected but indentation is present, default to spaced
                blockFormatting.commaSpacing = true;
            }

            if (blockFormatting.colonSpacing === undefined) {
                // If no spacing detected but indentation is present, default to spaced
                blockFormatting.colonSpacing = true;
            }

            if (blockFormatting.entryIndentation === undefined) {
                // If no indentation detected but indentation is present, default to indented
                blockFormatting.entryIndentation = true;
            }
        }

        formatting[this.getDelimiter()] = blockFormatting;

        formatting.indentationLevel = currentDepth;

        return {
            ...parent,
            ...formatting,
            brace: {
                ...parent.bracket,
                ...formatting.bracket,
                ...parent.brace,
                ...formatting.brace,
            },
            bracket: {
                ...parent.brace,
                ...formatting.brace,
                ...parent.bracket,
                ...formatting.bracket,
            },
        };
    }

    private indent(manipulator: NodeManipulator, formatting: Formatting, optional = false): void {
        const delimiter = this.getDelimiter();

        if ((formatting[delimiter]?.indentationSize ?? 0) <= 0) {
            return;
        }

        manipulator.token(
            new JsonTokenNode({
                type: JsonTokenType.NEWLINE,
                value: '\n',
            }),
            optional,
        );

        if (manipulator.matchesToken(JsonTokenType.WHITESPACE)) {
            manipulator.next();
        } else {
            manipulator.token(this.getIndentationToken(formatting), optional);
        }
    }

    private getIndentationToken(formatting: Formatting): JsonTokenNode {
        const delimiter = this.getDelimiter();
        const {indentationLevel = 0} = formatting;
        const {indentationSize = 0} = formatting[delimiter] ?? {};
        const char = formatting.indentationCharacter === 'tab' ? '\t' : ' ';

        return new JsonTokenNode({
            type: JsonTokenType.WHITESPACE,
            value: char.repeat(indentationLevel * indentationSize),
        });
    }

    private static* iterate(children: JsonNode[], maxDepth: number, depth = 0): Generator<DescendantNode> {
        for (const child of children) {
            if (child instanceof JsonTokenNode) {
                yield {
                    depth: depth,
                    token: child,
                };
            }

            if (maxDepth > 0 && child instanceof JsonCompositeNode) {
                yield* JsonStructureNode.iterate(child.children, maxDepth - 1, depth + 1);
            }
        }
    }

    private static matchesInsertion(manipulator: NodeManipulator, items: JsonNode[], index: number): boolean {
        const count = items.length;
        const currentNode = items[index];

        if (manipulator.matchesNext(currentNode.isEquivalent.bind(currentNode), NodeMatcher.ANY)) {
            // if it's later in the list, it has been moved, not prepended
            return false;
        }

        for (let i = index + 1; i < count; i++) {
            if (manipulator.matches(items[i])) {
                // if any of the following nodes match, it has been prepended
                return true;
            }
        }

        return false;
    }

    private static matchesRemoval(manipulator: NodeManipulator, items: JsonNode[], index: number): boolean {
        if (manipulator.matches(items[index])) {
            // if the current node matches, no previous nodes have been removed
            return false;
        }

        const nextItems = items.slice(index + 1);

        return manipulator.matchesNext(
            items[index].isEquivalent.bind(items[index]),
            // if any of the following nodes match one of
            // the remaining items before the current one,
            // items have been swapped, not dropped
            item => nextItems.every(nextItem => !nextItem.isEquivalent(item)),
        );
    }
}
