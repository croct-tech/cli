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
        const resolvedFormatting = this.resolveFormatting(formatting);

        for (const item of this.getList()) {
            item.rebuild({
                ...resolvedFormatting,
                indentationLevel: (formatting?.indentationLevel ?? 0) + 1,
            });
        }

        this.rebuildChildren(resolvedFormatting);
    }

    private rebuildChildren(formatting: Partial<Formatting>): void {
        const manipulator = new NodeManipulator(this.children);

        manipulator.token(this.getStartToken());

        const list = this.getList();
        const count = list.length;
        const {spaced = false, indentationSize = 0} = formatting;

        let previousMatched = false;

        for (let index = 0; index < count; index++) {
            const item = list[index];
            const leadingIndentation = index !== 0 || formatting.leadingIndentation !== false;

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
                    JsonStructureNode.indent(manipulator, formatting, previousMatched && currentMatched);
                }

                previousMatched = currentMatched;
                manipulator.node(item);
            }

            if (index === count - 1) {
                if (formatting.trailingIndentation !== false) {
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

                if (indentationSize === 0 && spaced) {
                    manipulator.token(
                        new JsonTokenNode({
                            type: JsonTokenType.WHITESPACE,
                            value: ' ',
                        }),
                    );
                }
            }
        }

        manipulator.token(this.getEndToken());

        manipulator.end();
    }

    protected abstract getList(): JsonTreeNode[];

    protected abstract getStartToken(): JsonTokenNode;

    protected abstract getEndToken(): JsonTokenNode;

    private resolveFormatting(defaultFormatting: Partial<Formatting>): Partial<Formatting> {
        const formatting: Partial<Formatting> = {...defaultFormatting};

        let blockStart = true;
        let lineStart = true;
        let punctuation = false;
        let lineIndentation = 0;
        let levelIndentation = 0;
        let leadingIndentation = false;
        let trailingIndentation = false;
        let empty = true;

        const startToken = this.getStartToken();
        const endToken = this.getEndToken();

        for (const {token, depth} of JsonStructureNode.iterate(this.children, 1)) {
            if (depth === 0 && startToken.isEquivalent(token)) {
                blockStart = true;
            } else if (depth === 0 && endToken.isEquivalent(token)) {
                trailingIndentation = lineStart;
            } else {
                if (!empty && blockStart) {
                    leadingIndentation = blockStart && lineStart;
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

                if (punctuation) {
                    formatting.spaced = true;
                }

                if (depth === 0 && lineStart) {
                    // ignore characters that are not spaces, like \r
                    lineIndentation = token.value.includes('\t')
                        ? token.value.replace(/[^\t]/g, '').length
                        : token.value.replace(/[^ ]/g, '').length;
                }
            }

            lineStart = token.type === JsonTokenType.NEW_LINE || (lineStart && token.type === JsonTokenType.WHITESPACE);

            punctuation = token.type === JsonTokenType.COMMA || token.type === JsonTokenType.COLON;
        }

        if (!empty) {
            formatting.indentationSize = 0;
            formatting.leadingIndentation = leadingIndentation;
            formatting.trailingIndentation = trailingIndentation;
        }

        const indentationLevel = Math.max(formatting.indentationLevel ?? 0, 0) + 1;

        if (levelIndentation > 0) {
            const remainder = levelIndentation % indentationLevel;

            formatting.indentationSize = (levelIndentation - remainder) / indentationLevel + remainder;

            if (formatting.spaced === undefined) {
                // If no spacing detected but indentation is present, default to spaced
                formatting.spaced = true;
            }
        }

        formatting.indentationLevel = indentationLevel;

        return formatting;
    }

    private static indent(manipulator: NodeManipulator, formatting: Partial<Formatting>, optional = false): void {
        const {indentationLevel = 0, indentationSize = 0} = formatting;

        if (indentationSize <= 0) {
            return;
        }

        manipulator.token(
            new JsonTokenNode({
                type: JsonTokenType.NEW_LINE,
                value: '\n',
            }),
            optional,
        );

        const char = formatting.indentationCharacter === 'tab' ? '\t' : ' ';

        if (manipulator.matchesToken(JsonTokenType.WHITESPACE)) {
            manipulator.next();
        } else {
            manipulator.token(
                new JsonTokenNode({
                    type: JsonTokenType.WHITESPACE,
                    value: char.repeat(indentationSize * indentationLevel),
                }),
                optional,
            );
        }
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
