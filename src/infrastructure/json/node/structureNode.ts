import {JsonValueNode} from './valueNode';
import {BlockFormatting, Formatting, JsonNode} from './node';
import {JsonTokenType} from '../token';
import {JsonTokenDefinition, JsonTokenNode} from './tokenNode';
import {NodeManipulator, NodeMatcher} from '../manipulator';
import {JsonCompositeNode} from './compositeNode';
import {JsonPropertyNode} from '@/infrastructure/json/node/propertyNode';
import COMMENT = NodeMatcher.COMMENT;
import WHITESPACE = NodeMatcher.WHITESPACE;
import NEWLINE = NodeMatcher.NEWLINE;
import SPACE = NodeMatcher.SPACE;
import INSIGNIFICANT = NodeMatcher.INSIGNIFICANT;

type DescendantNode = {
    depth: number,
    token: JsonTokenNode,
    parents: JsonCompositeNode[],
};

export enum StructureDelimiter {
    OBJECT = 'object',
    ARRAY = 'array',
}

export namespace StructureDelimiter {
    type TokenDefinition = {
        start: Omit<JsonTokenDefinition, 'location'>,
        end: Omit<JsonTokenDefinition, 'location'>,
    };

    const definitions: Record<StructureDelimiter, TokenDefinition> = {
        [StructureDelimiter.OBJECT]: {
            start: {
                type: JsonTokenType.BRACE_LEFT,
                value: '{',
            },
            end: {
                type: JsonTokenType.BRACE_RIGHT,
                value: '}',
            },
        },
        [StructureDelimiter.ARRAY]: {
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
            trailingComma = false,
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

                if (!currentMatched) {
                    JsonStructureNode.skipComments(manipulator);
                }

                if (leadingIndentation) {
                    if (indentationSize > 0 && manipulator.matchesNext(node => endToken.isEquivalent(node))) {
                        // If the following token is the end token, always indent.
                        // This ensures it won't consume the indentation of the end delimiter.
                        manipulator.node(
                            new JsonTokenNode({
                                type: JsonTokenType.NEWLINE,
                                value: '\n',
                            }),
                        );

                        if (
                            manipulator.matchesToken(JsonTokenType.WHITESPACE)
                            && manipulator.matchesNext(NodeMatcher.NEWLINE, NodeMatcher.WHITESPACE)
                        ) {
                            manipulator.remove();
                        }

                        manipulator.token(this.getIndentationToken(formatting));
                    } else {
                        this.indent(manipulator, formatting, previousMatched && currentMatched);
                    }
                }

                previousMatched = currentMatched;

                if (manipulator.matchesPreviousToken(JsonTokenType.LINE_COMMENT)) {
                    manipulator.insert(
                        new JsonTokenNode({
                            type: JsonTokenType.NEWLINE,
                            value: '\n',
                        }),
                    );
                } else if (
                    manipulator.position > 1
                    && !currentMatched
                    && manipulator.matchesPreviousToken(JsonTokenType.BLOCK_COMMENT)
                    && !manipulator.matchesToken(JsonTokenType.WHITESPACE)
                ) {
                    manipulator.previous();

                    const trailingSpace = manipulator.matchesPreviousToken(JsonTokenType.WHITESPACE);

                    manipulator.next();

                    if (trailingSpace) {
                        manipulator.token(
                            new JsonTokenNode({
                                type: JsonTokenType.WHITESPACE,
                                value: ' ',
                            }),
                        );
                    }
                }

                manipulator.node(item);
            }

            if (index < count - 1 || trailingComma) {
                manipulator.node(
                    new JsonTokenNode({
                        type: JsonTokenType.COMMA,
                        value: ',',
                    }),
                );
            }

            if (index === count - 1) {
                if (blockTrailingIndentation) {
                    this.indent(manipulator, {
                        ...formatting,
                        indentationLevel: indentationLevel - 1,
                    });
                }
            } else if (
                ((indentationSize === 0 || !entryIndentation) && commaSpacing)
                    && (
                        !manipulator.matchesNext(NodeMatcher.SPACE)
                        || manipulator.matchesNext(node => endToken.isEquivalent(node), NodeMatcher.SPACE)
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

        if (count === 0) {
            const index = manipulator.findNext(node => node.isEquivalent(endToken), NodeMatcher.ANY);

            if (index >= 0) {
                manipulator.dropUntil(node => node.isEquivalent(endToken));
            }
        }

        manipulator.token(endToken);

        manipulator.end();
    }

    protected abstract getList(): JsonCompositeNode[];

    protected abstract getDelimiter(): StructureDelimiter;

    protected abstract getMaxDepth(): number;

    private detectFormatting(parent: Formatting = {}): Formatting {
        let blockStart = false;
        let lineStart = true;
        let inlineComma = false;
        let inlineColon = false;
        let levelComma = false;
        let lineIndentationSize = 0;
        let levelIndentationSize = 0;
        let leadingIndentation: boolean | undefined;
        let trailingIndentation: boolean | undefined;
        let trailingComma = false;
        let newLine = false;
        let immediatelyClosed = true;
        let empty = true;

        const formatting: Formatting = {};
        const blockFormatting: BlockFormatting = {};

        const tokens = [...JsonStructureNode.iterate(this, this.getMaxDepth())];

        for (let index = 0; index < tokens.length; index++) {
            const {token, depth, parents} = tokens[index];

            switch (token.type) {
                case JsonTokenType.IDENTIFIER:
                    formatting.property = {
                        ...formatting.property,
                        unquoted: true,
                    };

                    break;

                case JsonTokenType.STRING: {
                    const grandParent = parents[parents.length - 2];
                    const quote = token.value.startsWith("'") ? 'single' : 'double';

                    if (
                        grandParent instanceof JsonPropertyNode
                        && grandParent.key.equals(parents[parents.length - 1])
                    ) {
                        formatting.property = {
                            ...formatting.property,
                            quote: quote,
                        };
                    } else {
                        formatting.string = {
                            ...formatting.string,
                            quote: quote,
                        };
                    }

                    break;
                }
            }

            if (depth === 0 && StructureDelimiter.isStartToken(token)) {
                blockStart = true;
            } else {
                const blockEnd = StructureDelimiter.isEndToken(token);

                if (depth === 0) {
                    if (blockEnd) {
                        trailingIndentation = lineStart;
                        trailingComma = levelComma;
                    }

                    if (blockStart) {
                        leadingIndentation = NEWLINE(token);

                        if (!WHITESPACE(token)) {
                            blockStart = false;
                        }
                    }
                }

                if (!blockEnd) {
                    // Use the last indentation size as the base
                    levelIndentationSize = lineIndentationSize;

                    immediatelyClosed = false;

                    if (!SPACE(token)) {
                        empty = false;
                    }
                }
            }

            if (WHITESPACE(token)) {
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

            if (inlineComma && index > 0 && tokens[index - 1].depth === 0) {
                if (!NEWLINE(token)) {
                    blockFormatting.commaSpacing = WHITESPACE(token);
                }

                let entryIndentation = NEWLINE(token);

                for (
                    let nextIndex = index;
                    !entryIndentation && nextIndex < tokens.length;
                    nextIndex++
                ) {
                    const {token: nextToken, depth: nextDepth} = tokens[nextIndex];

                    if (nextDepth === 0) {
                        if (WHITESPACE(nextToken) || COMMENT(nextToken)) {
                            continue;
                        }

                        if (NEWLINE(nextToken)) {
                            entryIndentation = true;
                        }
                    }

                    break;
                }

                blockFormatting.entryIndentation = entryIndentation;
                inlineComma = false;
            }

            if (inlineColon) {
                blockFormatting.colonSpacing = WHITESPACE(token);
                inlineColon = false;
            }

            inlineColon = token.type === JsonTokenType.COLON || (inlineColon && WHITESPACE(token));
            inlineComma = token.type === JsonTokenType.COMMA || (inlineComma && WHITESPACE(token));
            levelComma = (depth === 0 && token.type === JsonTokenType.COMMA) || (levelComma && INSIGNIFICANT(token));
            lineStart = NEWLINE(token) || (lineStart && WHITESPACE(token));
            newLine = newLine || NEWLINE(token);
        }

        if (!immediatelyClosed) {
            if (!empty) {
                blockFormatting.indentationSize = 0;
                blockFormatting.trailingComma = trailingComma;
            }

            blockFormatting.leadingIndentation = leadingIndentation ?? false;
            blockFormatting.trailingIndentation = trailingIndentation ?? false;
        }

        const currentDepth = Math.max(parent.indentationLevel ?? 0, 0) + 1;

        if (levelIndentationSize > 0 && !empty) {
            const remainder = levelIndentationSize % currentDepth;

            blockFormatting.indentationSize = (levelIndentationSize - remainder) / currentDepth + remainder;
        }

        if (newLine) {
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
            object: {
                ...parent.array,
                ...formatting.array,
                ...parent.object,
                ...formatting.object,
            },
            array: {
                ...parent.object,
                ...formatting.object,
                ...parent.array,
                ...formatting.array,
            },
        };
    }

    private indent(manipulator: NodeManipulator, formatting: Formatting, optional = false): void {
        const delimiter = this.getDelimiter();
        const {
            indentationSize = 0,
            leadingIndentation = false,
            trailingIndentation = false,
        } = formatting[delimiter] ?? {};

        if (indentationSize <= 0 && !leadingIndentation && !trailingIndentation) {
            return;
        }

        const newLine = new JsonTokenNode({
            type: JsonTokenType.NEWLINE,
            value: '\n',
        });

        manipulator.token(newLine, optional);

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

    private static* iterate(
        parent: JsonCompositeNode,
        maxDepth: number,
        parents: JsonCompositeNode[] = [],
    ): Generator<DescendantNode> {
        for (const child of parent.children) {
            if (child instanceof JsonTokenNode) {
                yield {
                    depth: parents.length,
                    token: child,
                    parents: [...parents, parent],
                };
            }

            if (maxDepth > 0 && child instanceof JsonCompositeNode) {
                yield* JsonStructureNode.iterate(child, maxDepth - 1, [...parents, parent]);
            }
        }
    }

    private static skipComments(manipulator: NodeManipulator): void {
        while (manipulator.matchesNext(NodeMatcher.COMMENT, NodeMatcher.SPACE)) {
            manipulator.next();
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
