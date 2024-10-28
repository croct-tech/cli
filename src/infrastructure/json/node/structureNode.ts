import {JsonValueNode} from './valueNode';
import {JsonNode} from './node';
import {JsonTokenType} from '../token';
import {JsonTokenNode} from './tokenNode';
import {NodeManipulator, NodeMatcher} from '../manipulator';
import {Formatting, JsonTreeNode} from '@/infrastructure/json/node/treeNode';

type DescendantNode = {
    depth: number,
    token: JsonTokenNode,
};

export abstract class JsonStructureNode extends JsonValueNode {
    public reset(): void {
        for (const item of this.getList()) {
            item.reset();
        }

        this.children.length = 0;
    }

    public rebuild(formatting: Partial<Formatting> = {}): void {
        const parentFormatting = this.resolveFormatting(formatting);

        let childFormatting = parentFormatting;

        for (let index = this.children.length - 1; index >= 0; index--) {
            const child = this.children[index];

            if (child instanceof JsonStructureNode) {
                // Extract the formatting from the last child
                childFormatting = child.resolveFormatting(parentFormatting);

                break;
            }
        }

        for (const item of this.getList()) {
            item.rebuild({
                ...childFormatting,
                indentationLevel: (formatting?.indentationLevel ?? 0) + 1,
            });
        }

        this.rebuildChildren(parentFormatting);
    }

    private rebuildChildren(formatting: Partial<Formatting>): void {
        const manipulator = new NodeManipulator(this.children);

        const endToken = this.getEndToken();

        manipulator.token(this.getStartToken());

        const list = this.getList();
        const count = list.length;

        const {
            commaSpacing = false,
            entryIndentation = true,
            blockLeadingIndentation = true,
            blockTrailingIndentation = true,
            indentationSize = 0,
        } = formatting;

        let previousMatched = false;

        for (let index = 0; index < count; index++) {
            const item = list[index];
            const leadingIndentation = (index !== 0 && entryIndentation) || (index === 0 && blockLeadingIndentation);

            if (JsonStructureNode.matchesInsertion(manipulator, list, index)) {
                if (leadingIndentation) {
                    JsonStructureNode.indent(manipulator, formatting);
                }

                manipulator.insert(item);
                previousMatched = false;
            } else if (JsonStructureNode.matchesRemoval(manipulator, list, index)) {
                manipulator.dropUntil(item.isEquivalent.bind(item));

                if (leadingIndentation && manipulator.matchesPreviousToken(JsonTokenType.NEW_LINE)) {
                    manipulator.previous();
                    JsonStructureNode.indent(manipulator, formatting);
                }

                previousMatched = true;
                manipulator.node(item);
            } else {
                const currentMatched = manipulator.matches(item);

                if (leadingIndentation) {
                    if (indentationSize > 0 && manipulator.matchesNext(node => endToken.isEquivalent(node))) {
                        // If the following token is the end token, always indent.
                        // This ensures it won't consume the indentation of the end delimiter.
                        manipulator.insert(
                            new JsonTokenNode({
                                type: JsonTokenType.NEW_LINE,
                                value: '\n',
                            }),
                        );

                        manipulator.insert(JsonStructureNode.getIndentationToken(formatting));
                    } else {
                        JsonStructureNode.indent(manipulator, formatting, previousMatched && currentMatched);
                    }
                }

                previousMatched = currentMatched;
                manipulator.node(item);
            }

            if (index === count - 1) {
                if (blockTrailingIndentation) {
                    JsonStructureNode.indent(manipulator, {
                        ...formatting,
                        indentationLevel: (formatting.indentationLevel ?? 0) - 1,
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

    protected abstract getList(): JsonTreeNode[];

    protected abstract getStartToken(): JsonTokenNode;

    protected abstract getEndToken(): JsonTokenNode;

    private resolveFormatting(defaultFormatting: Partial<Formatting>): Partial<Formatting> {
        const formatting: Partial<Formatting> = {...defaultFormatting};

        let blockStart = true;
        let lineStart = true;
        let comma = false;
        let colon = false;
        let lineIndentation = 0;
        let levelIndentation = 0;
        let blockLeadingIndentation = false;
        let blockTrailingIndentation = false;
        let empty = true;

        const startToken = this.getStartToken();
        const endToken = this.getEndToken();

        for (const {token, depth} of JsonStructureNode.iterate(this.children, 1)) {
            if (depth === 0 && startToken.isEquivalent(token)) {
                blockStart = true;
            } else if (depth === 0 && endToken.isEquivalent(token)) {
                blockTrailingIndentation = lineStart;
            } else {
                if (!empty && blockStart) {
                    blockLeadingIndentation = blockStart && lineStart;
                    blockStart = false;
                }

                // Use the last indentation level as the base
                levelIndentation = lineIndentation;

                empty = false;
            }

            if (token.type === JsonTokenType.WHITESPACE) {
                if (token.value.includes('\t')) {
                    formatting.indentationCharacter = 'tab';
                }

                if (depth === 0 && lineStart) {
                    // ignore characters that are not spaces, like \r
                    lineIndentation = token.value.includes('\t')
                        ? token.value.replace(/[^\t]/g, '').length
                        : token.value.replace(/[^ ]/g, '').length;
                }
            }

            if (depth === 0 && comma) {
                formatting.commaSpacing = token.type === JsonTokenType.WHITESPACE
                    || (formatting.commaSpacing === true && token.type === JsonTokenType.NEW_LINE);

                formatting.entryIndentation = token.type === JsonTokenType.NEW_LINE;
                comma = false;
            }

            if (colon) {
                formatting.colonSpacing = token.type === JsonTokenType.WHITESPACE;
                colon = false;
            }

            colon = token.type === JsonTokenType.COLON || (colon && token.type === JsonTokenType.WHITESPACE);
            comma = token.type === JsonTokenType.COMMA || (comma && token.type === JsonTokenType.WHITESPACE);

            lineStart = token.type === JsonTokenType.NEW_LINE || (lineStart && token.type === JsonTokenType.WHITESPACE);
        }

        if (!empty) {
            formatting.indentationSize = 0;
            formatting.blockLeadingIndentation = blockLeadingIndentation;
            formatting.blockTrailingIndentation = blockTrailingIndentation;
        }

        const indentationLevel = Math.max(formatting.indentationLevel ?? 0, 0) + 1;

        if (levelIndentation > 0) {
            const remainder = levelIndentation % indentationLevel;

            formatting.indentationSize = (levelIndentation - remainder) / indentationLevel + remainder;

            if (formatting.commaSpacing === undefined) {
                // If no spacing detected but indentation is present, default to spaced
                formatting.commaSpacing = true;
            }

            if (formatting.colonSpacing === undefined) {
                // If no spacing detected but indentation is present, default to spaced
                formatting.colonSpacing = true;
            }
        }

        formatting.indentationLevel = indentationLevel;

        return formatting;
    }

    private static indent(manipulator: NodeManipulator, formatting: Partial<Formatting>, optional = false): void {
        if ((formatting.indentationSize ?? 0) <= 0) {
            return;
        }

        manipulator.token(
            new JsonTokenNode({
                type: JsonTokenType.NEW_LINE,
                value: '\n',
            }),
            optional,
        );

        if (manipulator.matchesToken(JsonTokenType.WHITESPACE)) {
            manipulator.next();
        } else {
            manipulator.token(JsonStructureNode.getIndentationToken(formatting), optional);
        }
    }

    private static getIndentationToken(formatting: Partial<Formatting>): JsonTokenNode {
        const {indentationLevel = 0, indentationSize = 0} = formatting;
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

            if (maxDepth > 0 && child instanceof JsonTreeNode) {
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
